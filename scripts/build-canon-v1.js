const fs = require("fs");
const path = require("path");

const DEFAULT_INPUT = path.resolve("data/canon/source-canon-v1.json");
const DEFAULT_OUTPUT = path.resolve("data/canon/source-canon-v1.flat.json");
const DEFAULT_AUDIT = path.resolve("data/canon/source-canon-v1.source-audit.json");

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const slugify = (value) =>
  normalize(value)
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "") || "food";

const toStringArray = (value) =>
  Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
    : [];

const parseArgs = (argv) => {
  const args = {
    input: DEFAULT_INPUT,
    out: DEFAULT_OUTPUT,
    audit: DEFAULT_AUDIT
  };
  argv.forEach((arg) => {
    if (arg.startsWith("--input=")) {
      args.input = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--out=")) {
      args.out = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--audit=")) {
      args.audit = path.resolve(arg.split("=")[1]);
    }
  });
  return args;
};

const nextCanonicalId = (item, idCounts) => {
  const base = slugify(item.display_name);
  const candidateOrder = [
    base,
    `${base}-${slugify(item.food_group)}`,
    `${base}-${slugify(item.subgroup || item.food_group)}`,
    `${base}-${slugify(item.domain)}`,
    `${base}-${slugify(item.kingdom)}`
  ];
  for (const candidate of candidateOrder) {
    if (!idCounts.has(candidate)) {
      idCounts.set(candidate, 1);
      return candidate;
    }
  }
  const withCounterBase = `${base}-${slugify(item.food_group)}`;
  const next = (idCounts.get(withCounterBase) || 1) + 1;
  const finalId = `${withCounterBase}-${next}`;
  idCounts.set(withCounterBase, next);
  idCounts.set(finalId, 1);
  return finalId;
};

const flattenCanon = (payload) => {
  const rows = [];
  const sourceDomains = Array.isArray(payload?.canon) ? payload.canon : [];
  sourceDomains.forEach((domainEntry) => {
    const kingdom = String(domainEntry?.kingdom || "").trim();
    const domain = String(domainEntry?.domain || "").trim();
    const groups = Array.isArray(domainEntry?.groups) ? domainEntry.groups : [];
    groups.forEach((groupEntry) => {
      const foodGroup = String(groupEntry?.group || "").trim();
      const groupDefaultState = String(groupEntry?.default_state || "").trim() || "raw";
      const groupItems = Array.isArray(groupEntry?.items) ? groupEntry.items : [];
      groupItems.forEach((item) => {
        const displayName = String(item?.display_name || "").trim();
        if (!displayName) {
          return;
        }
        rows.push({
          display_name: displayName,
          canonical_name: displayName,
          kingdom,
          domain,
          food_group: foodGroup,
          subgroup: null,
          default_state: groupDefaultState,
          aliases: toStringArray(item?.aliases),
          variant_template_id:
            typeof item?.variant_template === "string" && item.variant_template.trim()
              ? item.variant_template.trim()
              : null,
          notes: typeof item?.notes === "string" && item.notes.trim() ? item.notes.trim() : null
        });
      });
      const subgroups = Array.isArray(groupEntry?.subgroups) ? groupEntry.subgroups : [];
      subgroups.forEach((subgroupEntry) => {
        const subgroup = String(subgroupEntry?.subgroup || "").trim();
        const subgroupItems = Array.isArray(subgroupEntry?.items) ? subgroupEntry.items : [];
        subgroupItems.forEach((item) => {
          const displayName = String(item?.display_name || "").trim();
          if (!displayName) {
            return;
          }
          rows.push({
            display_name: displayName,
            canonical_name: displayName,
            kingdom,
            domain,
            food_group: foodGroup,
            subgroup: subgroup || null,
            default_state: groupDefaultState,
            aliases: toStringArray(item?.aliases),
            variant_template_id:
              typeof item?.variant_template === "string" && item.variant_template.trim()
                ? item.variant_template.trim()
                : null,
            notes: typeof item?.notes === "string" && item.notes.trim() ? item.notes.trim() : null
          });
        });
      });
    });
  });
  const idCounts = new Map();
  const rowsWithIds = rows.map((row) => ({
    canonical_id: nextCanonicalId(row, idCounts),
    ...row
  }));
  return rowsWithIds;
};

const buildSourceAudit = (flatRows) => {
  const duplicateNameCounts = new Map();
  const duplicateAliasCounts = new Map();
  flatRows.forEach((row) => {
    const normalizedName = normalize(row.display_name);
    duplicateNameCounts.set(normalizedName, (duplicateNameCounts.get(normalizedName) || 0) + 1);
    row.aliases.forEach((alias) => {
      const normalizedAlias = normalize(alias);
      duplicateAliasCounts.set(normalizedAlias, (duplicateAliasCounts.get(normalizedAlias) || 0) + 1);
    });
  });

  const duplicatedDisplayNames = Array.from(duplicateNameCounts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ normalized_display_name: name, count }));
  const duplicatedAliases = Array.from(duplicateAliasCounts.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([alias, count]) => ({ normalized_alias: alias, count }));

  const grouped = flatRows.reduce((acc, row) => {
    const key = `${row.kingdom} > ${row.domain} > ${row.food_group}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    generated_at: new Date().toISOString(),
    total_items: flatRows.length,
    groups: grouped,
    duplicate_display_names: duplicatedDisplayNames,
    duplicate_aliases_top50: duplicatedAliases
  };
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.input)) {
    throw new Error(`Input file not found: ${args.input}`);
  }

  const raw = fs.readFileSync(args.input, "utf8");
  const payload = JSON.parse(raw);
  const flatRows = flattenCanon(payload);
  const sourceAudit = buildSourceAudit(flatRows);

  const variantDimensions = Array.isArray(payload?.variant_dimensions)
    ? payload.variant_dimensions
    : [];
  const variantTemplates = Array.isArray(payload?.variant_templates)
    ? payload.variant_templates
    : [];

  const output = {
    schema_version: payload?.schema_version || "1.0.0",
    name: payload?.name || "Source Canon Whole Foods",
    generated_at: new Date().toISOString(),
    principles: payload?.principles || {},
    variant_dimensions: variantDimensions,
    variant_templates: variantTemplates,
    items: flatRows
  };

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.mkdirSync(path.dirname(args.audit), { recursive: true });
  fs.writeFileSync(args.out, `${JSON.stringify(output, null, 2)}\n`);
  fs.writeFileSync(args.audit, `${JSON.stringify(sourceAudit, null, 2)}\n`);

  console.log(`Flattened ${flatRows.length} canon items -> ${args.out}`);
  console.log(`Wrote source audit -> ${args.audit}`);
};

main();
