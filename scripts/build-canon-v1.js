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

const dedupeStrings = (values) => {
  const seen = new Set();
  const out = [];
  values.forEach((value) => {
    const cleaned = typeof value === "string" ? value.trim() : "";
    if (!cleaned) {
      return;
    }
    const key = normalize(cleaned);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push(cleaned);
  });
  return out;
};

const cartesianProduct = (valueGroups) =>
  valueGroups.reduce(
    (acc, group) =>
      acc.flatMap((current) =>
        group.map((entry) => ({
          ...current,
          [entry.key]: entry.value
        }))
      ),
    [{}]
  );

const buildVariantDisplayName = (templateId, baseDisplayName, variantValues) => {
  if (templateId === "milk_fat_levels") {
    const level = variantValues.milkfat_level;
    if (level === "whole") return "Whole milk";
    if (level === "2%") return "2% milk";
    if (level === "1%") return "1% milk";
    if (level === "skim") return "Skim milk";
  }
  if (templateId === "yogurt_fat_levels") {
    const level = variantValues.yogurt_fat_level;
    if (level === "whole") return "Yogurt (plain)";
    if (level === "lowfat") return "Yogurt (plain, lowfat)";
    if (level === "nonfat") return "Yogurt (plain, nonfat)";
  }
  if (templateId === "cream_types") {
    const creamType = variantValues.cream_type;
    if (creamType === "half_and_half") return "Half and half";
    if (creamType === "light_cream") return "Light cream";
    if (creamType === "heavy_cream") return "Heavy cream";
  }
  if (templateId === "ground_beef_fat_percents") {
    const fatPercent = variantValues.ground_meat_fat_percent;
    if (typeof fatPercent === "number") {
      return `${baseDisplayName} (${fatPercent}% fat)`;
    }
  }
  if (templateId === "egg_parts") {
    const eggPart = variantValues.egg_part;
    if (eggPart === "whole") return baseDisplayName;
    if (eggPart === "white") return "Egg white";
    if (eggPart === "yolk") return "Egg yolk";
  }

  const fallbackLabel = Object.entries(variantValues)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(", ");
  return fallbackLabel ? `${baseDisplayName} (${fallbackLabel})` : baseDisplayName;
};

const buildVariantAliases = (templateId, baseDisplayName, variantValues, variantDisplayName) => {
  if (templateId === "milk_fat_levels") {
    const level = variantValues.milkfat_level;
    if (level === "whole") return ["whole milk", "full fat milk", "milk"];
    if (level === "2%") return ["2% milk", "milk 2%", "reduced fat milk"];
    if (level === "1%") return ["1% milk", "low fat milk"];
    if (level === "skim") return ["skim milk", "fat free milk"];
  }
  if (templateId === "yogurt_fat_levels") {
    const level = variantValues.yogurt_fat_level;
    if (level === "whole") return ["plain yogurt", "whole yogurt"];
    if (level === "lowfat") return ["plain lowfat yogurt", "low fat yogurt"];
    if (level === "nonfat") return ["plain nonfat yogurt", "fat free yogurt"];
  }
  if (templateId === "cream_types") {
    const creamType = variantValues.cream_type;
    if (creamType === "half_and_half") return ["half and half", "half-and-half"];
    if (creamType === "light_cream") return ["light cream", "coffee cream"];
    if (creamType === "heavy_cream") return ["heavy cream", "heavy whipping cream"];
  }
  if (templateId === "ground_beef_fat_percents") {
    const fatPercent = variantValues.ground_meat_fat_percent;
    if (typeof fatPercent === "number") {
      return [
        `ground beef ${fatPercent}%`,
        `ground beef ${fatPercent} percent`,
        `${fatPercent}% lean ground beef`
      ];
    }
  }
  if (templateId === "egg_parts") {
    const eggPart = variantValues.egg_part;
    if (eggPart === "whole") return ["whole egg", "egg", "eggs", "chicken egg"];
    if (eggPart === "white") return ["egg white", "egg whites", "eggwhite", "whites"];
    if (eggPart === "yolk") return ["egg yolk", "egg yolks", "eggyolk", "yolks"];
  }
  if (variantDisplayName !== baseDisplayName) {
    return [baseDisplayName];
  }
  return [];
};

const expandRowsWithVariants = (baseRows, payload) => {
  const dimensionByKey = new Map();
  (Array.isArray(payload?.variant_dimensions) ? payload.variant_dimensions : []).forEach((entry) => {
    const key = typeof entry?.key === "string" ? entry.key.trim() : "";
    if (!key) {
      return;
    }
    const allowedValues = Array.isArray(entry?.allowed_values) ? entry.allowed_values : [];
    if (!allowedValues.length) {
      return;
    }
    dimensionByKey.set(key, {
      key,
      allowed_values: allowedValues
    });
  });

  const templateById = new Map();
  (Array.isArray(payload?.variant_templates) ? payload.variant_templates : []).forEach((entry) => {
    const templateId = typeof entry?.template_id === "string" ? entry.template_id.trim() : "";
    if (!templateId) {
      return;
    }
    const dimensions = Array.isArray(entry?.dimensions) ? entry.dimensions : [];
    templateById.set(templateId, {
      template_id: templateId,
      dimensions
    });
  });

  const expanded = [];
  baseRows.forEach((row) => {
    const templateId = row.variant_template_id;
    if (!templateId || !templateById.has(templateId)) {
      expanded.push({
        ...row,
        variant_values: {}
      });
      return;
    }
    const template = templateById.get(templateId);
    const valueGroups = [];
    for (const dimension of template.dimensions) {
      const key = typeof dimension?.key === "string" ? dimension.key.trim() : "";
      const dimensionDef = key ? dimensionByKey.get(key) : null;
      if (!key || !dimensionDef || !Array.isArray(dimensionDef.allowed_values)) {
        expanded.push({
          ...row,
          variant_values: {}
        });
        return;
      }
      valueGroups.push(
        dimensionDef.allowed_values.map((value) => ({
          key,
          value
        }))
      );
    }

    if (!valueGroups.length) {
      expanded.push({
        ...row,
        variant_values: {}
      });
      return;
    }

    const variantCombos = cartesianProduct(valueGroups);
    variantCombos.forEach((variantValues) => {
      const variantDisplayName = buildVariantDisplayName(
        templateId,
        row.display_name,
        variantValues
      );
      const variantAliases = buildVariantAliases(
        templateId,
        row.display_name,
        variantValues,
        variantDisplayName
      );
      expanded.push({
        ...row,
        display_name: variantDisplayName,
        canonical_name: variantDisplayName,
        aliases: dedupeStrings([...(row.aliases || []), ...variantAliases]),
        variant_values: variantValues
      });
    });
  });
  return expanded;
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
  const expandedRows = expandRowsWithVariants(rows, payload);
  const idCounts = new Map();
  const rowsWithIds = expandedRows.map((row) => ({
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
