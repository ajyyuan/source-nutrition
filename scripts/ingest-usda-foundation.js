const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { createClient } = require("@supabase/supabase-js");

const NUTRIENT_KEYS = [
  "vitamin_a_ug",
  "vitamin_c_mg",
  "vitamin_d_ug",
  "vitamin_e_mg",
  "vitamin_k_ug",
  "vitamin_k2_ug",
  "thiamin_mg",
  "riboflavin_mg",
  "niacin_mg",
  "vitamin_b5_mg",
  "vitamin_b6_mg",
  "vitamin_b7_ug",
  "folate_ug",
  "vitamin_b12_ug",
  "calcium_mg",
  "iron_mg",
  "magnesium_mg",
  "phosphorus_mg",
  "potassium_mg",
  "zinc_mg",
  "selenium_ug",
  "omega3_g"
];

const NUTRIENT_NAME_MAP = [
  { key: "vitamin_a_ug", unit: "UG", names: ["vitamin a, rae"] },
  { key: "vitamin_c_mg", unit: "MG", names: ["vitamin c, total ascorbic acid"] },
  { key: "vitamin_d_ug", unit: "UG", names: ["vitamin d (d2 + d3)"] },
  { key: "vitamin_e_mg", unit: "MG", names: ["vitamin e (alpha-tocopherol)"] },
  { key: "vitamin_k_ug", unit: "UG", names: ["vitamin k (phylloquinone)"] },
  { key: "thiamin_mg", unit: "MG", names: ["thiamin"] },
  { key: "riboflavin_mg", unit: "MG", names: ["riboflavin"] },
  { key: "niacin_mg", unit: "MG", names: ["niacin"] },
  { key: "vitamin_b5_mg", unit: "MG", names: ["pantothenic acid", "vitamin b-5"] },
  { key: "vitamin_b6_mg", unit: "MG", names: ["vitamin b-6"] },
  { key: "vitamin_b7_ug", unit: "UG", names: ["biotin", "vitamin b-7"] },
  { key: "folate_ug", unit: "UG", names: ["folate, total"] },
  { key: "vitamin_b12_ug", unit: "UG", names: ["vitamin b-12"] },
  { key: "calcium_mg", unit: "MG", names: ["calcium, ca"] },
  { key: "iron_mg", unit: "MG", names: ["iron, fe"] },
  { key: "magnesium_mg", unit: "MG", names: ["magnesium, mg"] },
  { key: "phosphorus_mg", unit: "MG", names: ["phosphorus, p"] },
  { key: "potassium_mg", unit: "MG", names: ["potassium, k"] },
  { key: "zinc_mg", unit: "MG", names: ["zinc, zn"] },
  { key: "selenium_ug", unit: "UG", names: ["selenium, se"] },
  { key: "omega3_g", unit: "G", names: ["fatty acids, total omega-3"] }
];

const ZERO_VECTOR = NUTRIENT_KEYS.reduce((acc, key) => {
  acc[key] = 0;
  return acc;
}, {});
const DEFAULT_DATA_TYPE_FILTERS = ["foundation", "sr legacy"];

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

const readCsv = (filePath) => {
  const content = fs.readFileSync(filePath, "utf8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true
  });
};

const parseDataTypeFilters = (args) => {
  const dataTypeFlag = args.find(
    (arg) => arg.startsWith("--data-types=") || arg.startsWith("--types=")
  );
  const rawFilters = dataTypeFlag
    ? dataTypeFlag.split("=")[1]
    : DEFAULT_DATA_TYPE_FILTERS.join(",");
  const filters = rawFilters
    .split(",")
    .map((value) => normalize(value))
    .filter(Boolean);
  if (filters.includes("all")) {
    return ["all"];
  }
  return filters.length ? filters : [...DEFAULT_DATA_TYPE_FILTERS];
};

const shouldIncludeDataType = (rawDataType, normalizedFilters) => {
  if (normalizedFilters.includes("all")) {
    return true;
  }
  const normalizedDataType = normalize(rawDataType);
  if (!normalizedDataType) {
    return true;
  }
  return normalizedFilters.some((filter) => normalizedDataType.includes(filter));
};

const sumPer100gVector = (vector) =>
  NUTRIENT_KEYS.reduce((acc, key) => acc + (Number.isFinite(vector[key]) ? vector[key] : 0), 0);

const findHeader = (headers, candidates) => {
  const normalized = headers.map((name) => normalize(name));
  const matchIndex = normalized.findIndex((name) =>
    candidates.some((candidate) => name === normalize(candidate))
  );
  if (matchIndex === -1) {
    return null;
  }
  return headers[matchIndex];
};

const getColumnMap = (headers, requiredMap) => {
  const resolved = {};
  Object.entries(requiredMap).forEach(([key, candidates]) => {
    const header = findHeader(headers, candidates);
    if (!header) {
      throw new Error(`Missing column for ${key}. Headers: ${headers.join(", ")}`);
    }
    resolved[key] = header;
  });
  return resolved;
};

const buildNutrientLookup = (nutrientRows) => {
  const headers = Object.keys(nutrientRows[0] || {});
  const columns = getColumnMap(headers, {
    id: ["id", "nutrient_id"],
    name: ["name", "nutrient_name"],
    unit: ["unit_name", "unit"]
  });

  const lookup = new Map();
  nutrientRows.forEach((row) => {
    const id = String(row[columns.id] ?? "").trim();
    if (!id) {
      return;
    }
    const name = normalize(row[columns.name]);
    const unit = String(row[columns.unit] ?? "").trim().toUpperCase();
    const match = NUTRIENT_NAME_MAP.find(
      (entry) => entry.unit === unit && entry.names.some((candidate) => normalize(candidate) === name)
    );
    if (match) {
      lookup.set(id, match.key);
    }
  });

  return lookup;
};

const main = async () => {
  const args = process.argv.slice(2);
  const dataDir = args[0] ? path.resolve(args[0]) : path.resolve("usda");
  const limitFlag = args.find((arg) => arg.startsWith("--limit="));
  const limit = limitFlag ? Number(limitFlag.split("=")[1]) : null;
  const dryRun = args.includes("--dry-run");
  const outputFlag = args.find((arg) => arg.startsWith("--out="));
  const outputPath = outputFlag ? path.resolve(outputFlag.split("=")[1]) : null;
  const dataTypeFilters = parseDataTypeFilters(args);
  const includeZeroVectors = args.includes("--include-zero-vectors");

  const foodPath = path.join(dataDir, "food.csv");
  const nutrientPath = path.join(dataDir, "nutrient.csv");
  const foodNutrientPath = path.join(dataDir, "food_nutrient.csv");

  if (!fs.existsSync(foodPath) || !fs.existsSync(nutrientPath) || !fs.existsSync(foodNutrientPath)) {
    throw new Error(
      "Expected food.csv, nutrient.csv, and food_nutrient.csv inside the data directory."
    );
  }

  const foodRows = readCsv(foodPath);
  const nutrientRows = readCsv(nutrientPath);
  const foodNutrientRows = readCsv(foodNutrientPath);

  const foodHeaders = Object.keys(foodRows[0] || {});
  const foodColumns = getColumnMap(foodHeaders, {
    fdcId: ["fdc_id", "fdc id"],
    description: ["description", "food_description"],
    dataType: ["data_type", "data type"]
  });

  const foods = new Map();
  const includedTypeCounts = new Map();
  foodRows.forEach((row) => {
    const fdcId = String(row[foodColumns.fdcId] ?? "").trim();
    if (!fdcId) {
      return;
    }
    const description = String(row[foodColumns.description] ?? "").trim();
    const dataType = String(row[foodColumns.dataType] ?? "").trim().toLowerCase();
    if (!shouldIncludeDataType(dataType, dataTypeFilters)) {
      return;
    }
    const dataTypeLabel = dataType || "(missing)";
    includedTypeCounts.set(dataTypeLabel, (includedTypeCounts.get(dataTypeLabel) || 0) + 1);
    foods.set(fdcId, { description, fdcId });
  });

  const nutrientLookup = buildNutrientLookup(nutrientRows);
  const nutrientHeaders = Object.keys(foodNutrientRows[0] || {});
  const nutrientColumns = getColumnMap(nutrientHeaders, {
    fdcId: ["fdc_id", "fdc id"],
    nutrientId: ["nutrient_id", "nutrient id"],
    amount: ["amount", "value"]
  });

  const perFood = new Map();
  foodNutrientRows.forEach((row) => {
    const fdcId = String(row[nutrientColumns.fdcId] ?? "").trim();
    if (!foods.has(fdcId)) {
      return;
    }
    const nutrientId = String(row[nutrientColumns.nutrientId] ?? "").trim();
    const key = nutrientLookup.get(nutrientId);
    if (!key) {
      return;
    }
    const amount = Number(row[nutrientColumns.amount]);
    if (!Number.isFinite(amount)) {
      return;
    }
    const entry = perFood.get(fdcId) ?? { ...ZERO_VECTOR };
    entry[key] = amount;
    perFood.set(fdcId, entry);
  });

  const slugCounts = new Map();
  const rows = [];
  let skippedZeroVectors = 0;
  for (const [fdcId, info] of foods.entries()) {
    if (!info.description) {
      continue;
    }
    const baseSlug = slugify(info.description);
    const count = (slugCounts.get(baseSlug) ?? 0) + 1;
    slugCounts.set(baseSlug, count);
    const canonicalId = count === 1 ? baseSlug : `${baseSlug}-${fdcId}`;
    const per_100g = perFood.get(fdcId) ?? { ...ZERO_VECTOR };
    if (!includeZeroVectors && sumPer100gVector(per_100g) === 0) {
      skippedZeroVectors += 1;
      continue;
    }
    rows.push({
      canonical_id: canonicalId,
      canonical_name: info.description,
      per_100g,
      source: "usda",
      fdc_id: String(fdcId)
    });
    if (limit && rows.length >= limit) {
      break;
    }
  }

  if (outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2));
    console.log(`Wrote ${rows.length} rows to ${outputPath}`);
  } else {
    console.log(`Prepared ${rows.length} rows.`);
  }
  console.log(
    `Included USDA data types: ${
      dataTypeFilters.includes("all") ? "all" : dataTypeFilters.join(", ")
    }`
  );
  console.log(
    `Included type counts: ${Array.from(includedTypeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([type, count]) => `${type}=${count}`)
      .join(", ")}`
  );
  if (skippedZeroVectors > 0) {
    console.log(`Skipped ${skippedZeroVectors} rows with all-zero tracked micronutrients.`);
  }

  if (dryRun) {
    console.log("Dry run: skipping Supabase insert.");
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required.");
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("canonical_foods").upsert(chunk, {
      onConflict: "canonical_id"
    });
    if (error) {
      throw new Error(`Supabase insert failed: ${error.message}`);
    }
    console.log(`Inserted ${i + chunk.length} / ${rows.length}`);
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
