const fs = require("fs");
const path = require("path");

const DEFAULT_FLAT_PATH = path.resolve("data/canon/source-canon-v1.flat.json");
const DEFAULT_CURATION_PATH = path.resolve("data/canon/source-canon-v1.manual-curation.json");
const DEFAULT_OUTPUT_PATH = path.resolve("data/canon/source-canon-v1.provenance.json");

const parseArgs = (argv) => {
  const out = {
    flatPath: DEFAULT_FLAT_PATH,
    curationPath: DEFAULT_CURATION_PATH,
    outPath: DEFAULT_OUTPUT_PATH
  };
  argv.forEach((arg) => {
    if (arg.startsWith("--flat=")) {
      out.flatPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--curation=")) {
      out.curationPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--out=")) {
      out.outPath = path.resolve(arg.split("=")[1]);
    }
  });
  return out;
};

const classifySourceKind = (sourceDataset) => {
  const value = String(sourceDataset || "").trim().toLowerCase();
  if (!value) return "unknown";
  if (value === "sr_legacy_food" || value === "foundation_food" || value === "survey_food") {
    return "usda_local_csv";
  }
  if (value.startsWith("usda_api")) {
    return "usda_online_api";
  }
  if (value === "openfoodfacts") {
    return "openfoodfacts";
  }
  if (value === "canadian_nutrient_file") {
    return "canadian_nutrient_file";
  }
  return "other";
};

const run = () => {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.flatPath)) {
    throw new Error(`Missing flat canon file: ${options.flatPath}`);
  }
  if (!fs.existsSync(options.curationPath)) {
    throw new Error(`Missing curation file: ${options.curationPath}`);
  }

  const flatPayload = JSON.parse(fs.readFileSync(options.flatPath, "utf8"));
  const curationPayload = JSON.parse(fs.readFileSync(options.curationPath, "utf8"));
  const flatItems = Array.isArray(flatPayload?.items) ? flatPayload.items : [];
  const curatedMatches = Array.isArray(curationPayload?.matches) ? curationPayload.matches : [];
  const curatedById = new Map(
    curatedMatches.map((row) => [String(row?.canonical_id || "").trim(), row]).filter(([id]) => id)
  );

  const items = flatItems.map((item) => {
    const canonicalId = String(item?.canonical_id || "").trim();
    const match = curatedById.get(canonicalId) || null;
    const sourceDataset = match?.source_dataset || null;
    return {
      canonical_id: canonicalId,
      canonical_name: item?.canonical_name || item?.display_name || canonicalId,
      source_dataset: sourceDataset,
      source_kind: classifySourceKind(sourceDataset),
      source_name: match?.source_name || null,
      fdc_id: match?.fdc_id || null,
      confidence: match?.confidence || null,
      score: Number.isFinite(match?.score) ? match.score : null,
      notes: match?.notes || null
    };
  });

  const byDataset = new Map();
  const bySourceKind = new Map();
  items.forEach((entry) => {
    const datasetKey = entry.source_dataset || "missing";
    byDataset.set(datasetKey, (byDataset.get(datasetKey) || 0) + 1);
    const sourceKindKey = entry.source_kind || "unknown";
    bySourceKind.set(sourceKindKey, (bySourceKind.get(sourceKindKey) || 0) + 1);
  });

  const output = {
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    inputs: {
      flat_path: options.flatPath,
      curation_path: options.curationPath
    },
    summary: {
      total_items: items.length,
      with_source_dataset: items.filter((entry) => !!entry.source_dataset).length,
      missing_source_dataset: items.filter((entry) => !entry.source_dataset).length,
      by_source_kind: Array.from(bySourceKind.entries())
        .map(([source_kind, count]) => ({ source_kind, count }))
        .sort((a, b) => b.count - a.count || a.source_kind.localeCompare(b.source_kind)),
      by_source_dataset: Array.from(byDataset.entries())
        .map(([source_dataset, count]) => ({ source_dataset, count }))
        .sort((a, b) => b.count - a.count || a.source_dataset.localeCompare(b.source_dataset))
    },
    items
  };

  fs.mkdirSync(path.dirname(options.outPath), { recursive: true });
  fs.writeFileSync(options.outPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote provenance manifest: ${options.outPath}`);
  console.log(
    `Provenance coverage -> total: ${output.summary.total_items}, tracked: ${output.summary.with_source_dataset}, missing: ${output.summary.missing_source_dataset}`
  );
};

run();
