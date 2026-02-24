const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const NUTRIENT_SPECS = [
  { key: "vitamin_a_ug", label: "Vitamin A", unit: "ug" },
  { key: "vitamin_c_mg", label: "Vitamin C", unit: "mg" },
  { key: "vitamin_d_ug", label: "Vitamin D", unit: "ug" },
  { key: "vitamin_e_mg", label: "Vitamin E", unit: "mg" },
  { key: "vitamin_k_ug", label: "Vitamin K", unit: "ug" },
  { key: "vitamin_k2_ug", label: "Vitamin K2", unit: "ug" },
  { key: "thiamin_mg", label: "Thiamin (B1)", unit: "mg" },
  { key: "riboflavin_mg", label: "Riboflavin (B2)", unit: "mg" },
  { key: "niacin_mg", label: "Niacin (B3)", unit: "mg" },
  { key: "vitamin_b5_mg", label: "Pantothenic acid (B5)", unit: "mg" },
  { key: "vitamin_b6_mg", label: "Vitamin B6", unit: "mg" },
  { key: "vitamin_b7_ug", label: "Biotin (B7)", unit: "ug" },
  { key: "folate_ug", label: "Folate (B9)", unit: "ug" },
  { key: "vitamin_b12_ug", label: "Vitamin B12", unit: "ug" },
  { key: "calcium_mg", label: "Calcium", unit: "mg" },
  { key: "iron_mg", label: "Iron", unit: "mg" },
  { key: "magnesium_mg", label: "Magnesium", unit: "mg" },
  { key: "phosphorus_mg", label: "Phosphorus", unit: "mg" },
  { key: "potassium_mg", label: "Potassium", unit: "mg" },
  { key: "zinc_mg", label: "Zinc", unit: "mg" },
  { key: "selenium_ug", label: "Selenium", unit: "ug" },
  { key: "omega3_g", label: "Omega-3", unit: "g" }
];

const USDA_DATASET_NAMES = new Set(["sr_legacy_food", "foundation_food", "survey_food"]);

const DEFAULT_PREVIEW_PATH = path.resolve("data/canon/source-canon-v1.reseed-preview.json");
const DEFAULT_CURATION_PATH = path.resolve("data/canon/source-canon-v1.manual-curation.json");
const DEFAULT_SUPPLEMENTAL_SOURCES_PATH = path.resolve(
  "data/canon/source-canon-v1.supplemental-source-rows.json"
);
const DEFAULT_USDA_DIRS = [
  path.resolve("data/FoodData_Central_sr_legacy_food_csv_2018-04"),
  path.resolve("data/FoodData_Central_foundation_food_csv_2025-12-18"),
  path.resolve("data/FoodData_Central_survey_food_csv_2022-10-28")
];

const DEFAULT_DISPLAY_MATRIX_OUT = path.resolve("data/canon/source-canon-v1.micronutrient-matrix.csv");
const DEFAULT_VALUES_MATRIX_OUT = path.resolve(
  "data/canon/source-canon-v1.micronutrient-matrix-values.csv"
);
const DEFAULT_STATUS_MATRIX_OUT = path.resolve(
  "data/canon/source-canon-v1.micronutrient-matrix-status.csv"
);
const DEFAULT_COVERAGE_OUT = path.resolve("data/canon/source-canon-v1.micronutrient-coverage.csv");
const DEFAULT_SUMMARY_OUT = path.resolve(
  "data/canon/source-canon-v1.micronutrient-coverage-summary.json"
);

const NUTRIENT_NAME_MAP = [
  { key: "vitamin_a_ug", unit: "UG", names: ["vitamin a, rae"], priority: 3 },
  { key: "vitamin_a_ug", unit: "UG", names: ["retinol"], priority: 2 },
  { key: "vitamin_a_ug", unit: "IU", names: ["vitamin a, iu"], priority: 1 },
  { key: "vitamin_c_mg", unit: "MG", names: ["vitamin c, total ascorbic acid"] },
  { key: "vitamin_d_ug", unit: "UG", names: ["vitamin d (d2 + d3)"], priority: 2 },
  {
    key: "vitamin_d_ug",
    unit: "IU",
    names: ["vitamin d (d2 + d3), international units"],
    priority: 1
  },
  { key: "vitamin_e_mg", unit: "MG", names: ["vitamin e (alpha-tocopherol)"] },
  { key: "vitamin_k_ug", unit: "UG", names: ["vitamin k (phylloquinone)"] },
  { key: "thiamin_mg", unit: "MG", names: ["thiamin"] },
  { key: "riboflavin_mg", unit: "MG", names: ["riboflavin"] },
  { key: "niacin_mg", unit: "MG", names: ["niacin"] },
  { key: "vitamin_b5_mg", unit: "MG", names: ["pantothenic acid", "vitamin b-5"] },
  { key: "vitamin_b6_mg", unit: "MG", names: ["vitamin b-6"] },
  { key: "vitamin_b7_ug", unit: "UG", names: ["biotin", "vitamin b-7"] },
  { key: "folate_ug", unit: "UG", names: ["folate, total"], priority: 2 },
  { key: "folate_ug", unit: "UG", names: ["folate, dfe"], priority: 1 },
  { key: "vitamin_b12_ug", unit: "UG", names: ["vitamin b-12"] },
  { key: "calcium_mg", unit: "MG", names: ["calcium, ca"] },
  { key: "iron_mg", unit: "MG", names: ["iron, fe"] },
  { key: "magnesium_mg", unit: "MG", names: ["magnesium, mg"] },
  { key: "phosphorus_mg", unit: "MG", names: ["phosphorus, p"] },
  { key: "potassium_mg", unit: "MG", names: ["potassium, k"] },
  { key: "zinc_mg", unit: "MG", names: ["zinc, zn"] },
  { key: "selenium_ug", unit: "UG", names: ["selenium, se"] },
  { key: "omega3_g", unit: "G", names: ["fatty acids, total omega-3"], priority: 5 },
  { key: "omega3_g", unit: "G", names: ["pufa 18:3 n-3 c,c,c (ala)"], priority: 4 },
  { key: "omega3_g", unit: "G", names: ["pufa 18:3 c"], priority: 1 },
  { key: "omega3_g", unit: "G", names: ["pufa 20:5 n-3 (epa)"], priority: 4 },
  { key: "omega3_g", unit: "G", names: ["pufa 20:5c"], priority: 1 },
  { key: "omega3_g", unit: "G", names: ["pufa 22:6 n-3 (dha)"], priority: 4 },
  { key: "omega3_g", unit: "G", names: ["pufa 22:6 c"], priority: 1 }
];

const parseArgs = (argv) => {
  const out = {
    previewPath: DEFAULT_PREVIEW_PATH,
    curationPath: DEFAULT_CURATION_PATH,
    supplementalSourcesPath: DEFAULT_SUPPLEMENTAL_SOURCES_PATH,
    usdaDirs: DEFAULT_USDA_DIRS,
    displayMatrixOutPath: DEFAULT_DISPLAY_MATRIX_OUT,
    valuesMatrixOutPath: DEFAULT_VALUES_MATRIX_OUT,
    statusMatrixOutPath: DEFAULT_STATUS_MATRIX_OUT,
    coverageOutPath: DEFAULT_COVERAGE_OUT,
    summaryOutPath: DEFAULT_SUMMARY_OUT
  };
  argv.forEach((arg) => {
    if (arg.startsWith("--preview=")) {
      out.previewPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--curation=")) {
      out.curationPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--supplemental-sources=")) {
      out.supplementalSourcesPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--usda-dirs=")) {
      out.usdaDirs = arg
        .split("=")[1]
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => path.resolve(entry));
    } else if (arg.startsWith("--matrix-out=")) {
      out.displayMatrixOutPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--matrix-values-out=")) {
      out.valuesMatrixOutPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--matrix-status-out=")) {
      out.statusMatrixOutPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--coverage-out=")) {
      out.coverageOutPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--summary-out=")) {
      out.summaryOutPath = path.resolve(arg.split("=")[1]);
    }
  });
  return out;
};

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const asNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const escapeCsvValue = (value) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
};

const toCsv = (rows) => `${rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n")}\n`;

const getFoodColumnHeaders = (rows) => {
  const nameCounts = new Map();
  rows.forEach((row) => {
    const canonicalName = String(row?.canonical_name || row?.display_name || row?.canonical_id || "").trim();
    nameCounts.set(canonicalName, (nameCounts.get(canonicalName) || 0) + 1);
  });
  return rows.map((row) => {
    const canonicalName = String(row?.canonical_name || row?.display_name || row?.canonical_id || "").trim();
    const canonicalId = String(row?.canonical_id || "").trim();
    return nameCounts.get(canonicalName) > 1 ? `${canonicalName} (${canonicalId})` : canonicalName;
  });
};

const findHeader = (headers, candidates) => {
  const normalized = headers.map((header) => normalize(header));
  const idx = normalized.findIndex((header) =>
    candidates.some((candidate) => header === normalize(candidate))
  );
  return idx >= 0 ? headers[idx] : null;
};

const getColumnMap = (headers, spec) => {
  const out = {};
  Object.entries(spec).forEach(([name, candidates]) => {
    const header = findHeader(headers, candidates);
    if (!header) {
      throw new Error(`Missing CSV column for ${name}.`);
    }
    out[name] = header;
  });
  return out;
};

const parseCsv = (filePath) =>
  parse(fs.readFileSync(filePath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true
  });

const getDatasetNameFromUsdaDir = (usdaDir) => {
  const base = path.basename(usdaDir);
  if (base.includes("sr_legacy_food")) return "sr_legacy_food";
  if (base.includes("foundation_food")) return "foundation_food";
  if (base.includes("survey_food")) return "survey_food";
  throw new Error(`Unable to infer USDA dataset name from directory: ${usdaDir}`);
};

const mapKey = (dataset, fdcId) => `${dataset}::${fdcId}`;

const buildNutrientLookup = (nutrientRows) => {
  const headers = Object.keys(nutrientRows[0] || {});
  const cols = getColumnMap(headers, {
    id: ["id", "nutrient_id"],
    name: ["name", "nutrient_name"],
    unit: ["unit_name", "unit"]
  });
  const lookup = new Map();
  nutrientRows.forEach((row) => {
    const id = String(row[cols.id] || "").trim();
    if (!id) {
      return;
    }
    const name = normalize(row[cols.name]);
    const unit = String(row[cols.unit] || "").trim().toUpperCase();
    const match = NUTRIENT_NAME_MAP.find(
      (entry) => entry.unit === unit && entry.names.some((candidate) => normalize(candidate) === name)
    );
    if (match) {
      const existing = lookup.get(id);
      const next = {
        key: match.key,
        priority: Number.isFinite(match.priority) ? match.priority : 1
      };
      if (!existing || next.priority >= existing.priority) {
        lookup.set(id, next);
      }
    }
  });
  return lookup;
};

const buildUsdaReportedLookup = (usdaDirs) => {
  const reportedByDatasetAndFdcId = new Map();
  (Array.isArray(usdaDirs) ? usdaDirs : []).forEach((usdaDir) => {
    const foodNutrientPath = path.join(usdaDir, "food_nutrient.csv");
    const nutrientPath = path.join(usdaDir, "nutrient.csv");
    if (!fs.existsSync(foodNutrientPath) || !fs.existsSync(nutrientPath)) {
      throw new Error(
        `Missing USDA nutrient files in ${usdaDir}. Expected nutrient.csv and food_nutrient.csv.`
      );
    }

    const datasetName = getDatasetNameFromUsdaDir(usdaDir);
    const nutrientRows = parseCsv(nutrientPath);
    const foodNutrientRows = parseCsv(foodNutrientPath);
    const nutrientLookup = buildNutrientLookup(nutrientRows);
    const cols = getColumnMap(Object.keys(foodNutrientRows[0] || {}), {
      fdcId: ["fdc_id", "fdc id"],
      nutrientId: ["nutrient_id", "nutrient id"],
      amount: ["amount", "value"]
    });

    foodNutrientRows.forEach((row) => {
      const fdcId = String(row[cols.fdcId] || "").trim();
      if (!fdcId) {
        return;
      }
      const nutrientId = String(row[cols.nutrientId] || "").trim();
      const mapped = nutrientLookup.get(nutrientId);
      if (!mapped) {
        return;
      }
      const amount = Number(row[cols.amount]);
      if (!Number.isFinite(amount)) {
        return;
      }
      const key = mapKey(datasetName, fdcId);
      if (!reportedByDatasetAndFdcId.has(key)) {
        reportedByDatasetAndFdcId.set(key, new Set());
      }
      reportedByDatasetAndFdcId.get(key).add(mapped.key);
    });
  });
  return reportedByDatasetAndFdcId;
};

const loadCurationByCanonicalId = (curationPath) => {
  if (!curationPath || !fs.existsSync(curationPath)) {
    return new Map();
  }
  const payload = JSON.parse(fs.readFileSync(curationPath, "utf8"));
  const matches = Array.isArray(payload?.matches) ? payload.matches : [];
  const map = new Map();
  matches.forEach((row) => {
    const canonicalId = String(row?.canonical_id || "").trim();
    if (!canonicalId) {
      return;
    }
    map.set(canonicalId, row);
  });
  return map;
};

const loadSupplementalReportedLookup = (supplementalSourcesPath) => {
  const byDatasetAndFdcId = new Map();
  const byFdcId = new Map();
  if (!supplementalSourcesPath || !fs.existsSync(supplementalSourcesPath)) {
    return { byDatasetAndFdcId, byFdcId };
  }
  const payload = JSON.parse(fs.readFileSync(supplementalSourcesPath, "utf8"));
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  rows.forEach((row) => {
    const fdcId = String(row?.fdc_id || "").trim();
    if (!fdcId) {
      return;
    }
    const sourceDataset = String(row?.source_dataset || "supplemental").trim();
    const per100g = row?.per_100g && typeof row.per_100g === "object" ? row.per_100g : {};
    const reportedKeys = NUTRIENT_SPECS.filter((nutrient) =>
      Object.prototype.hasOwnProperty.call(per100g, nutrient.key)
    ).map((nutrient) => nutrient.key);
    const set = new Set(reportedKeys);
    byDatasetAndFdcId.set(mapKey(sourceDataset, fdcId), set);
    byFdcId.set(fdcId, set);
  });
  return { byDatasetAndFdcId, byFdcId };
};

const analyzeRows = (
  previewRows,
  curationByCanonicalId,
  usdaReportedByDatasetAndFdcId,
  supplementalReportedLookup
) =>
  previewRows.map((row) => {
    const canonicalId = String(row?.canonical_id || "").trim();
    const curationEntry = curationByCanonicalId.get(canonicalId) || null;
    const sourceDataset = String(curationEntry?.source_dataset || "").trim();
    const fdcId = String(row?.fdc_id || "").trim();

    let reportedSet = null;
    if (sourceDataset && USDA_DATASET_NAMES.has(sourceDataset) && fdcId) {
      reportedSet = usdaReportedByDatasetAndFdcId.get(mapKey(sourceDataset, fdcId)) || new Set();
    } else if (fdcId) {
      reportedSet =
        supplementalReportedLookup.byDatasetAndFdcId.get(mapKey(sourceDataset, fdcId)) ||
        supplementalReportedLookup.byFdcId.get(fdcId) ||
        null;
    }

    const values = {};
    const statuses = {};
    const per100g = row?.per_100g && typeof row.per_100g === "object" ? row.per_100g : {};
    NUTRIENT_SPECS.forEach((nutrient) => {
      const value = asNumber(per100g[nutrient.key]);
      values[nutrient.key] = value;
      const hasValueInPreview = Object.prototype.hasOwnProperty.call(per100g, nutrient.key);
      if (!reportedSet) {
        statuses[nutrient.key] = "unknown";
      } else if (reportedSet.has(nutrient.key) || hasValueInPreview) {
        statuses[nutrient.key] = "reported";
      } else {
        statuses[nutrient.key] = "missing";
      }
    });

    return {
      ...row,
      source_dataset: sourceDataset,
      values,
      statuses
    };
  });

const buildMatrixRows = (rows, mode) => {
  const headers = getFoodColumnHeaders(rows);
  const matrix = [["nutrient_key", "nutrient_label", "unit", ...headers]];
  NUTRIENT_SPECS.forEach((nutrient) => {
    const row = [nutrient.key, nutrient.label, nutrient.unit];
    rows.forEach((foodRow) => {
      const value = foodRow.values[nutrient.key];
      const status = foodRow.statuses[nutrient.key];
      if (mode === "status") {
        row.push(status);
      } else if (mode === "display") {
        if (status === "missing") {
          row.push("");
        } else if (status === "unknown") {
          row.push("?");
        } else {
          row.push(value);
        }
      } else {
        row.push(value);
      }
    });
    matrix.push(row);
  });
  return matrix;
};

const buildCoverageRows = (rows) => {
  const coverage = rows.map((row) => {
    const missingNutrients = [];
    const unknownNutrients = [];
    const reportedZeroNutrients = [];
    let reportedCount = 0;
    let nonZeroReportedCount = 0;

    NUTRIENT_SPECS.forEach((nutrient) => {
      const key = nutrient.key;
      const status = row.statuses[key];
      const value = row.values[key];
      if (status === "missing") {
        missingNutrients.push(key);
      } else if (status === "unknown") {
        unknownNutrients.push(key);
      } else {
        reportedCount += 1;
        if (value > 0) {
          nonZeroReportedCount += 1;
        } else {
          reportedZeroNutrients.push(key);
        }
      }
    });

    return {
      canonical_id: String(row?.canonical_id || "").trim(),
      canonical_name: String(row?.canonical_name || row?.display_name || "").trim(),
      domain: String(row?.domain || "").trim(),
      food_group: String(row?.food_group || "").trim(),
      source_dataset: String(row?.source_dataset || "").trim(),
      fdc_id: String(row?.fdc_id || "").trim(),
      source: String(row?.source || "").trim(),
      match_status: String(row?.match_status || "").trim(),
      reported_nutrients: reportedCount,
      missing_nutrients: missingNutrients.length,
      unknown_nutrients: unknownNutrients.length,
      nonzero_reported_nutrients: nonZeroReportedCount,
      zero_reported_nutrients: reportedZeroNutrients.length,
      total_nutrients: NUTRIENT_SPECS.length,
      reported_ratio: Number((reportedCount / NUTRIENT_SPECS.length).toFixed(4)),
      nonzero_reported_ratio: Number((nonZeroReportedCount / NUTRIENT_SPECS.length).toFixed(4)),
      missing_nutrient_keys: missingNutrients.join("|"),
      unknown_nutrient_keys: unknownNutrients.join("|"),
      reported_zero_nutrient_keys: reportedZeroNutrients.join("|")
    };
  });

  coverage.sort((a, b) => {
    if (a.missing_nutrients !== b.missing_nutrients) {
      return b.missing_nutrients - a.missing_nutrients;
    }
    if (a.unknown_nutrients !== b.unknown_nutrients) {
      return b.unknown_nutrients - a.unknown_nutrients;
    }
    if (a.nonzero_reported_nutrients !== b.nonzero_reported_nutrients) {
      return a.nonzero_reported_nutrients - b.nonzero_reported_nutrients;
    }
    return a.canonical_name.localeCompare(b.canonical_name);
  });

  const rowsOut = [
    [
      "canonical_id",
      "canonical_name",
      "domain",
      "food_group",
      "source_dataset",
      "fdc_id",
      "source",
      "match_status",
      "reported_nutrients",
      "missing_nutrients",
      "unknown_nutrients",
      "nonzero_reported_nutrients",
      "zero_reported_nutrients",
      "total_nutrients",
      "reported_ratio",
      "nonzero_reported_ratio",
      "missing_nutrient_keys",
      "unknown_nutrient_keys",
      "reported_zero_nutrient_keys"
    ]
  ];
  coverage.forEach((entry) => {
    rowsOut.push([
      entry.canonical_id,
      entry.canonical_name,
      entry.domain,
      entry.food_group,
      entry.source_dataset,
      entry.fdc_id,
      entry.source,
      entry.match_status,
      entry.reported_nutrients,
      entry.missing_nutrients,
      entry.unknown_nutrients,
      entry.nonzero_reported_nutrients,
      entry.zero_reported_nutrients,
      entry.total_nutrients,
      entry.reported_ratio,
      entry.nonzero_reported_ratio,
      entry.missing_nutrient_keys,
      entry.unknown_nutrient_keys,
      entry.reported_zero_nutrient_keys
    ]);
  });
  return { rowsOut, coverage };
};

const run = () => {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.previewPath)) {
    throw new Error(`Missing reseed preview file: ${options.previewPath}`);
  }

  const payload = JSON.parse(fs.readFileSync(options.previewPath, "utf8"));
  const previewRows = Array.isArray(payload?.rows) ? payload.rows : [];
  if (!previewRows.length) {
    throw new Error("Reseed preview file has no rows.");
  }

  const curationByCanonicalId = loadCurationByCanonicalId(options.curationPath);
  const usdaReportedByDatasetAndFdcId = buildUsdaReportedLookup(options.usdaDirs);
  const supplementalReportedLookup = loadSupplementalReportedLookup(options.supplementalSourcesPath);

  const analyzedRows = analyzeRows(
    previewRows,
    curationByCanonicalId,
    usdaReportedByDatasetAndFdcId,
    supplementalReportedLookup
  );

  const displayMatrixRows = buildMatrixRows(analyzedRows, "display");
  const valuesMatrixRows = buildMatrixRows(analyzedRows, "values");
  const statusMatrixRows = buildMatrixRows(analyzedRows, "status");
  const { rowsOut: coverageRows, coverage } = buildCoverageRows(analyzedRows);

  const summary = {
    schema_version: "1.1.0",
    generated_at: new Date().toISOString(),
    inputs: {
      preview_path: options.previewPath,
      curation_path: options.curationPath,
      supplemental_sources_path: options.supplementalSourcesPath
    },
    totals: {
      foods: analyzedRows.length,
      nutrients: NUTRIENT_SPECS.length,
      foods_with_any_missing: coverage.filter((row) => row.missing_nutrients > 0).length,
      foods_with_all_reported: coverage.filter(
        (row) => row.missing_nutrients === 0 && row.unknown_nutrients === 0
      ).length,
      foods_with_any_unknown: coverage.filter((row) => row.unknown_nutrients > 0).length,
      foods_with_zero_nonzero_reported: coverage.filter((row) => row.nonzero_reported_nutrients === 0).length
    },
    by_domain_missing: Object.values(
      coverage.reduce((acc, row) => {
        const key = row.domain || "unknown";
        if (!acc[key]) {
          acc[key] = {
            domain: key,
            total: 0,
            with_missing: 0,
            with_unknown: 0,
            all_reported: 0
          };
        }
        acc[key].total += 1;
        if (row.missing_nutrients > 0) acc[key].with_missing += 1;
        if (row.unknown_nutrients > 0) acc[key].with_unknown += 1;
        if (row.missing_nutrients === 0 && row.unknown_nutrients === 0) acc[key].all_reported += 1;
        return acc;
      }, {})
    ).sort((a, b) => b.with_missing - a.with_missing || b.with_unknown - a.with_unknown),
    highest_missing_foods: coverage.slice(0, 30)
  };

  fs.mkdirSync(path.dirname(options.displayMatrixOutPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.valuesMatrixOutPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.statusMatrixOutPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.coverageOutPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.summaryOutPath), { recursive: true });

  fs.writeFileSync(options.displayMatrixOutPath, toCsv(displayMatrixRows));
  fs.writeFileSync(options.valuesMatrixOutPath, toCsv(valuesMatrixRows));
  fs.writeFileSync(options.statusMatrixOutPath, toCsv(statusMatrixRows));
  fs.writeFileSync(options.coverageOutPath, toCsv(coverageRows));
  fs.writeFileSync(options.summaryOutPath, `${JSON.stringify(summary, null, 2)}\n`);

  console.log(`Wrote display matrix CSV (missing blank, unknown '?'): ${options.displayMatrixOutPath}`);
  console.log(`Wrote raw values matrix CSV: ${options.valuesMatrixOutPath}`);
  console.log(`Wrote status matrix CSV (reported|missing|unknown): ${options.statusMatrixOutPath}`);
  console.log(`Wrote coverage CSV: ${options.coverageOutPath}`);
  console.log(`Wrote coverage summary JSON: ${options.summaryOutPath}`);
  console.log(
    `Foods=${summary.totals.foods}, nutrients=${summary.totals.nutrients}, any_missing=${summary.totals.foods_with_any_missing}, all_reported=${summary.totals.foods_with_all_reported}, any_unknown=${summary.totals.foods_with_any_unknown}`
  );
};

run();
