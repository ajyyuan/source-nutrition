const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { parse } = require("csv-parse/sync");

const NUTRIENT_KEYS = [
  "vitamin_a_ug",
  "vitamin_c_mg",
  "vitamin_d_ug",
  "vitamin_e_mg",
  "vitamin_k_ug",
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

const DEFAULT_FLAT_INPUT = path.resolve("data/canon/source-canon-v1.flat.json");
const DEFAULT_AUDIT_OUTPUT = path.resolve("data/canon/source-canon-v1.match-audit.json");
const DEFAULT_PREVIEW_OUTPUT = path.resolve("data/canon/source-canon-v1.reseed-preview.json");
const DEFAULT_USDA_DIR = path.resolve("data/FoodData_Central_sr_legacy_food_csv_2018-04");
const DEFAULT_USDA_DIRS = [
  path.resolve("data/FoodData_Central_sr_legacy_food_csv_2018-04"),
  path.resolve("data/FoodData_Central_foundation_food_csv_2025-12-18"),
  path.resolve("data/FoodData_Central_survey_food_csv_2022-10-28")
];
const DEFAULT_PRIORITY_ALIASES_PATH = path.resolve("data/canon/founder-priority-aliases-v1.json");
const DEFAULT_CURATION_PATH = path.resolve("data/canon/source-canon-v1.manual-curation.json");
const DEFAULT_SUPPLEMENTAL_SOURCES_PATH = path.resolve(
  "data/canon/source-canon-v1.supplemental-source-rows.json"
);
const CHUNK_SIZE = 500;

const NUTRIENT_NAME_MAP = [
  { key: "vitamin_a_ug", unit: "UG", names: ["vitamin a, rae"], factor: 1, priority: 3 },
  { key: "vitamin_a_ug", unit: "UG", names: ["retinol"], factor: 1, priority: 2 },
  { key: "vitamin_a_ug", unit: "IU", names: ["vitamin a, iu"], factor: 0.3, priority: 1 },
  { key: "vitamin_c_mg", unit: "MG", names: ["vitamin c, total ascorbic acid"] },
  { key: "vitamin_d_ug", unit: "UG", names: ["vitamin d (d2 + d3)"], factor: 1, priority: 2 },
  {
    key: "vitamin_d_ug",
    unit: "IU",
    names: ["vitamin d (d2 + d3), international units"],
    factor: 0.025,
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
  { key: "folate_ug", unit: "UG", names: ["folate, total"], factor: 1, priority: 2 },
  { key: "folate_ug", unit: "UG", names: ["folate, dfe"], factor: 1, priority: 1 },
  { key: "vitamin_b12_ug", unit: "UG", names: ["vitamin b-12"] },
  { key: "calcium_mg", unit: "MG", names: ["calcium, ca"] },
  { key: "iron_mg", unit: "MG", names: ["iron, fe"] },
  { key: "magnesium_mg", unit: "MG", names: ["magnesium, mg"] },
  { key: "phosphorus_mg", unit: "MG", names: ["phosphorus, p"] },
  { key: "potassium_mg", unit: "MG", names: ["potassium, k"] },
  { key: "zinc_mg", unit: "MG", names: ["zinc, zn"] },
  { key: "selenium_ug", unit: "UG", names: ["selenium, se"] },
  { key: "omega3_g", unit: "G", names: ["fatty acids, total omega-3"], priority: 5 },
  { key: "omega3_g", unit: "G", names: ["pufa 18:3 n-3 c,c,c (ala)"], priority: 4, omega3_component: "ala" },
  { key: "omega3_g", unit: "G", names: ["pufa 18:3 c"], priority: 1, omega3_component: "ala" },
  { key: "omega3_g", unit: "G", names: ["pufa 20:5 n-3 (epa)"], priority: 4, omega3_component: "epa" },
  { key: "omega3_g", unit: "G", names: ["pufa 20:5c"], priority: 1, omega3_component: "epa" },
  { key: "omega3_g", unit: "G", names: ["pufa 22:6 n-3 (dha)"], priority: 4, omega3_component: "dha" },
  { key: "omega3_g", unit: "G", names: ["pufa 22:6 c"], priority: 1, omega3_component: "dha" }
];

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokenize = (value) =>
  normalize(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

const makeZeroVector = () =>
  NUTRIENT_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

const normalizePer100g = (value) => {
  const out = makeZeroVector();
  if (!value || typeof value !== "object") {
    return out;
  }
  NUTRIENT_KEYS.forEach((key) => {
    const raw = value[key];
    out[key] = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  });
  return out;
};

const sumPer100gVector = (value) =>
  NUTRIENT_KEYS.reduce((acc, key) => acc + (Number.isFinite(value[key]) ? value[key] : 0), 0);

const parseArgs = (argv) => {
  const options = {
    flatPath: DEFAULT_FLAT_INPUT,
    auditPath: DEFAULT_AUDIT_OUTPUT,
    previewPath: DEFAULT_PREVIEW_OUTPUT,
    usdaDir: DEFAULT_USDA_DIR,
    usdaDirs: DEFAULT_USDA_DIRS,
    priorityAliasesPath: DEFAULT_PRIORITY_ALIASES_PATH,
    curationPath: DEFAULT_CURATION_PATH,
    supplementalSourcesPath: DEFAULT_SUPPLEMENTAL_SOURCES_PATH,
    strictCuration: true,
    sourceUsda: false,
    apply: false
  };
  argv.forEach((arg) => {
    if (arg === "--apply") {
      options.apply = true;
    } else if (arg.startsWith("--flat=")) {
      options.flatPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--audit=")) {
      options.auditPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--preview=")) {
      options.previewPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--usda-dir=")) {
      options.usdaDir = path.resolve(arg.split("=")[1]);
      options.usdaDirs = [options.usdaDir];
    } else if (arg.startsWith("--usda-dirs=")) {
      const raw = arg.split("=")[1];
      options.usdaDirs = raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => path.resolve(entry));
    } else if (arg.startsWith("--priority-aliases=")) {
      options.priorityAliasesPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--curation=")) {
      options.curationPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--supplemental-sources=")) {
      options.supplementalSourcesPath = path.resolve(arg.split("=")[1]);
    } else if (arg === "--no-strict-curation") {
      options.strictCuration = false;
    } else if (arg === "--source-usda") {
      options.sourceUsda = true;
    }
  });
  return options;
};

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
      lookup.set(id, {
        key: match.key,
        factor: Number.isFinite(match.factor) ? match.factor : 1,
        priority: Number.isFinite(match.priority) ? match.priority : 1,
        omega3_component: typeof match.omega3_component === "string" ? match.omega3_component : null
      });
    }
  });
  return lookup;
};

const loadSourceRowsFromUsdaCsv = (usdaDir) => {
  const foodPath = path.join(usdaDir, "food.csv");
  const nutrientPath = path.join(usdaDir, "nutrient.csv");
  const foodNutrientPath = path.join(usdaDir, "food_nutrient.csv");
  if (!fs.existsSync(foodPath) || !fs.existsSync(nutrientPath) || !fs.existsSync(foodNutrientPath)) {
    throw new Error(
      `Missing USDA csv files in ${usdaDir}. Expected food.csv, nutrient.csv, food_nutrient.csv.`
    );
  }
  const foodRows = readCsv(foodPath);
  const nutrientRows = readCsv(nutrientPath);
  const foodNutrientRows = readCsv(foodNutrientPath);

  const foodCols = getColumnMap(Object.keys(foodRows[0] || {}), {
    fdcId: ["fdc_id", "fdc id"],
    description: ["description", "food_description"]
  });
  const nutrientCols = getColumnMap(Object.keys(foodNutrientRows[0] || {}), {
    fdcId: ["fdc_id", "fdc id"],
    nutrientId: ["nutrient_id", "nutrient id"],
    amount: ["amount", "value"]
  });
  const nutrientLookup = buildNutrientLookup(nutrientRows);

  const foodsById = new Map();
  foodRows.forEach((row) => {
    const fdcId = String(row[foodCols.fdcId] || "").trim();
    const canonicalName = String(row[foodCols.description] || "").trim();
    if (!fdcId || !canonicalName) {
      return;
    }
    foodsById.set(fdcId, {
      canonical_id: `legacy-${fdcId}`,
      canonical_name: canonicalName,
      fdc_id: fdcId,
      source: "usda",
      per_100g: makeZeroVector(),
      _nutrient_priority: {},
      _omega3_components: {},
      _omega3_component_priority: {}
    });
  });
  foodNutrientRows.forEach((row) => {
    const fdcId = String(row[nutrientCols.fdcId] || "").trim();
    if (!foodsById.has(fdcId)) {
      return;
    }
    const nutrientId = String(row[nutrientCols.nutrientId] || "").trim();
    const mapped = nutrientLookup.get(nutrientId);
    if (!mapped) {
      return;
    }
    const amount = Number(row[nutrientCols.amount]);
    if (!Number.isFinite(amount)) {
      return;
    }
    const convertedAmount = amount * mapped.factor;
    if (!Number.isFinite(convertedAmount)) {
      return;
    }
    const target = foodsById.get(fdcId);
    if (mapped.key === "omega3_g" && mapped.omega3_component) {
      const currentComponentPriority = Number.isFinite(
        target._omega3_component_priority[mapped.omega3_component]
      )
        ? target._omega3_component_priority[mapped.omega3_component]
        : -Infinity;
      if (mapped.priority >= currentComponentPriority) {
        target._omega3_components[mapped.omega3_component] = convertedAmount;
        target._omega3_component_priority[mapped.omega3_component] = mapped.priority;
      }
      return;
    }
    const currentPriority = Number.isFinite(target._nutrient_priority[mapped.key])
      ? target._nutrient_priority[mapped.key]
      : -Infinity;
    if (mapped.priority >= currentPriority) {
      target.per_100g[mapped.key] = convertedAmount;
      target._nutrient_priority[mapped.key] = mapped.priority;
    }
  });
  return dedupeByCanonicalId(
    Array.from(foodsById.values()).map((row) => {
      if (
        !Number.isFinite(row._nutrient_priority.omega3_g) &&
        Object.keys(row._omega3_components).length > 0
      ) {
        row.per_100g.omega3_g = Object.values(row._omega3_components).reduce(
          (acc, value) => acc + (Number.isFinite(value) ? value : 0),
          0
        );
        row._nutrient_priority.omega3_g = 0;
      }
      const { _nutrient_priority, _omega3_components, _omega3_component_priority, ...rest } = row;
      return rest;
    })
  );
};

const loadSourceRowsFromUsdaCsvs = (usdaDirs) => {
  const rowsByFdcId = new Map();
  (Array.isArray(usdaDirs) ? usdaDirs : []).forEach((dir) => {
    const rows = loadSourceRowsFromUsdaCsv(dir);
    rows.forEach((row) => {
      const fdcId = typeof row?.fdc_id === "string" ? row.fdc_id.trim() : "";
      if (!fdcId) {
        return;
      }
      const existing = rowsByFdcId.get(fdcId);
      if (!existing || sumPer100gVector(row.per_100g) > sumPer100gVector(existing.per_100g)) {
        rowsByFdcId.set(fdcId, row);
      }
    });
  });
  return dedupeByCanonicalId(Array.from(rowsByFdcId.values()));
};

const loadSupplementalSourceRows = (supplementalSourcesPath) => {
  if (!supplementalSourcesPath || !fs.existsSync(supplementalSourcesPath)) {
    return [];
  }
  const payload = JSON.parse(fs.readFileSync(supplementalSourcesPath, "utf8"));
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  return rows
    .map((row) => {
      const fdcId = typeof row?.fdc_id === "string" ? row.fdc_id.trim() : "";
      if (!fdcId) {
        return null;
      }
      return {
        canonical_id:
          typeof row?.canonical_id === "string" && row.canonical_id.trim()
            ? row.canonical_id.trim()
            : `supplemental-${fdcId}`,
        canonical_name:
          typeof row?.canonical_name === "string" && row.canonical_name.trim()
            ? row.canonical_name.trim()
            : fdcId,
        fdc_id: fdcId,
        source: "supplemental",
        source_dataset:
          typeof row?.source_dataset === "string" && row.source_dataset.trim()
            ? row.source_dataset.trim()
            : "supplemental",
        per_100g: normalizePer100g(row?.per_100g)
      };
    })
    .filter(Boolean);
};

const mergeSourceRowsByFdcId = (...rowGroups) => {
  const merged = new Map();
  rowGroups.forEach((group) => {
    (Array.isArray(group) ? group : []).forEach((row) => {
      const fdcId = typeof row?.fdc_id === "string" ? row.fdc_id.trim() : "";
      if (!fdcId) {
        return;
      }
      const existing = merged.get(fdcId);
      if (!existing || sumPer100gVector(row.per_100g || {}) >= sumPer100gVector(existing.per_100g || {})) {
        merged.set(fdcId, row);
      }
    });
  });
  return Array.from(merged.values());
};

const loadCurationMap = (curationPath) => {
  if (!curationPath || !fs.existsSync(curationPath)) {
    return new Map();
  }
  const payload = JSON.parse(fs.readFileSync(curationPath, "utf8"));
  const entries = Array.isArray(payload?.matches) ? payload.matches : [];
  const map = new Map();
  entries.forEach((entry) => {
    const canonicalId = typeof entry?.canonical_id === "string" ? entry.canonical_id.trim() : "";
    if (!canonicalId) {
      return;
    }
    map.set(canonicalId, {
      canonical_id: canonicalId,
      fdc_id: typeof entry?.fdc_id === "string" ? entry.fdc_id.trim() : "",
      source_name: typeof entry?.source_name === "string" ? entry.source_name.trim() : "",
      confidence: typeof entry?.confidence === "string" ? entry.confidence.trim() : "",
      score: Number(entry?.score || 0)
    });
  });
  return map;
};

const scoreCandidate = (query, candidateName, state) => {
  const normalizedQuery = normalize(query);
  const normalizedCandidate = normalize(candidateName);
  if (!normalizedQuery || !normalizedCandidate) {
    return 0;
  }

  let score = 0;
  if (normalizedCandidate === normalizedQuery) {
    score += 1.3;
  } else if (normalizedCandidate.startsWith(`${normalizedQuery} `)) {
    score += 1.05;
  } else if (normalizedCandidate.startsWith(normalizedQuery)) {
    score += 0.9;
  } else if (normalizedCandidate.includes(` ${normalizedQuery} `)) {
    score += 0.78;
  } else if (normalizedCandidate.includes(normalizedQuery)) {
    score += 0.62;
  }

  const queryTokens = tokenize(normalizedQuery);
  const candidateTokenSet = new Set(tokenize(normalizedCandidate));
  if (queryTokens.length && candidateTokenSet.size) {
    const overlap = queryTokens.filter((token) => candidateTokenSet.has(token)).length;
    if (overlap > 0) {
      const precision = overlap / queryTokens.length;
      const recall = overlap / candidateTokenSet.size;
      const tokenF1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
      score += tokenF1 * 0.75;
    }
  }

  if (state === "raw") {
    if (normalizedCandidate.includes(" raw")) {
      score += 0.12;
    }
    if (normalizedCandidate.includes(" cooked")) {
      score -= 0.08;
    }
  }

  if (state === "fermented" && normalizedCandidate.includes("fermented")) {
    score += 0.08;
  }

  if (/restaurant|fast food|frozen dinner|tv dinner|baby food/.test(normalizedCandidate)) {
    score -= 0.18;
  }
  return score;
};

const buildNameIndex = (rows) => {
  const map = new Map();
  rows.forEach((row) => {
    const key = normalize(row.canonical_name);
    if (!key) {
      return;
    }
    const bucket = map.get(key) || [];
    bucket.push(row);
    map.set(key, bucket);
  });
  return map;
};

const pickBest = (candidates, item) => {
  if (!candidates.length) {
    return null;
  }
  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(item.display_name, candidate.canonical_name, item.default_state)
    }))
    .sort((a, b) => b.score - a.score);
  return scored[0] || null;
};

const dedupeByCanonicalId = (rows) => {
  const seen = new Set();
  const out = [];
  rows.forEach((row) => {
    const id = typeof row?.canonical_id === "string" ? row.canonical_id.trim() : "";
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    out.push({
      ...row,
      canonical_id: id,
      canonical_name:
        typeof row?.canonical_name === "string" && row.canonical_name.trim()
          ? row.canonical_name.trim()
          : id,
      per_100g: normalizePer100g(row?.per_100g),
      source: row?.source === "usda" ? "usda" : "stub",
      fdc_id: typeof row?.fdc_id === "string" && row.fdc_id.trim() ? row.fdc_id.trim() : null
    });
  });
  return out;
};

const loadAllCanonicalRows = async (supabase) => {
  const rows = [];
  let from = 0;
  while (true) {
    const to = from + CHUNK_SIZE - 1;
    const { data, error } = await supabase
      .from("canonical_foods")
      .select("*")
      .range(from, to);
    if (error) {
      throw new Error(`Failed loading canonical_foods: ${error.message}`);
    }
    if (!Array.isArray(data) || !data.length) {
      break;
    }
    rows.push(...data);
    if (data.length < CHUNK_SIZE) {
      break;
    }
    from += CHUNK_SIZE;
  }
  return dedupeByCanonicalId(rows);
};

const chunk = (values, size) => {
  const out = [];
  for (let i = 0; i < values.length; i += size) {
    out.push(values.slice(i, i + size));
  }
  return out;
};

const loadPriorityAliases = (priorityAliasesPath) => {
  if (!priorityAliasesPath || !fs.existsSync(priorityAliasesPath)) {
    return [];
  }
  const payload = JSON.parse(fs.readFileSync(priorityAliasesPath, "utf8"));
  return Array.isArray(payload?.aliases) ? payload.aliases : [];
};

const buildAliasRows = (items, priorityAliases) => {
  const map = new Map();
  const canonicalIdByName = new Map();
  items.forEach((item) => {
    canonicalIdByName.set(normalize(item.canonical_name), item.canonical_id);
  });
  items.forEach((item) => {
    const aliases = Array.isArray(item.aliases) ? item.aliases : [];
    aliases.forEach((alias) => {
      const normalizedAlias = normalize(alias);
      if (!normalizedAlias || map.has(normalizedAlias)) {
        return;
      }
      map.set(normalizedAlias, {
        alias: normalizedAlias,
        canonical_id: item.canonical_id
      });
    });
  });
  (Array.isArray(priorityAliases) ? priorityAliases : []).forEach((entry) => {
    const canonicalName =
      typeof entry?.canonical_name === "string" ? entry.canonical_name.trim() : "";
    if (!canonicalName) {
      return;
    }
    const canonicalId = canonicalIdByName.get(normalize(canonicalName));
    if (!canonicalId) {
      return;
    }
    const aliases = Array.isArray(entry?.aliases) ? entry.aliases : [];
    aliases.forEach((alias) => {
      const normalizedAlias = normalize(alias);
      if (!normalizedAlias || map.has(normalizedAlias)) {
        return;
      }
      map.set(normalizedAlias, {
        alias: normalizedAlias,
        canonical_id: canonicalId
      });
    });
  });
  return Array.from(map.values());
};

const matchCanonItems = (flatItems, sourceRows, curationByCanonicalId, strictCuration) => {
  const nameIndex = buildNameIndex(sourceRows);
  const sourceByFdcId = new Map();
  sourceRows.forEach((row) => {
    const fdcId = typeof row?.fdc_id === "string" ? row.fdc_id.trim() : "";
    if (fdcId) {
      sourceByFdcId.set(fdcId, row);
    }
  });
  const audit = {
    generated_at: new Date().toISOString(),
    total_items: flatItems.length,
    counts: {
      curated: 0,
      matched: 0,
      fuzzy: 0,
      unmatched: 0
    },
    curated: [],
    matched: [],
    fuzzy: [],
    unmatched: []
  };

  const rows = flatItems.map((item) => {
    const exactNameMatches = nameIndex.get(normalize(item.display_name)) || [];
    let selected = null;
    let matchStatus = "unmatched";
    let matchSource = null;
    let matchConfidence = 0;

    const curatedEntry = curationByCanonicalId.get(item.canonical_id) || null;
    if (curatedEntry) {
      if (curatedEntry.fdc_id && sourceByFdcId.has(curatedEntry.fdc_id)) {
        selected = {
          candidate: sourceByFdcId.get(curatedEntry.fdc_id),
          score: Number.isFinite(curatedEntry.score) ? curatedEntry.score : 1.5
        };
        matchStatus = "curated";
        matchSource = "manual_curation_fdc_id";
        matchConfidence = selected.score;
      } else if (curatedEntry.source_name) {
        const curatedNameMatches = nameIndex.get(normalize(curatedEntry.source_name)) || [];
        const curatedNameSelected = pickBest(curatedNameMatches, item);
        if (curatedNameSelected) {
          selected = curatedNameSelected;
          matchStatus = "curated";
          matchSource = "manual_curation_name";
          matchConfidence = selected.score;
        }
      }
    }

    if (!selected && !strictCuration) {
      if (exactNameMatches.length) {
        selected = pickBest(exactNameMatches, item);
        if (selected) {
          matchStatus = "matched";
          matchSource = "db_exact_name";
          matchConfidence = selected.score;
        }
      }
      if (!selected) {
        const aliasMatches = [];
        (item.aliases || []).forEach((alias) => {
          const aliasMatch = nameIndex.get(normalize(alias)) || [];
          aliasMatches.push(...aliasMatch);
        });
        if (aliasMatches.length) {
          selected = pickBest(aliasMatches, item);
          if (selected) {
            matchStatus = "matched";
            matchSource = "db_exact_alias";
            matchConfidence = selected.score;
          }
        }
      }
      if (!selected) {
        const fuzzy = pickBest(sourceRows, item);
        if (fuzzy && fuzzy.score >= 0.95) {
          selected = fuzzy;
          matchStatus = "fuzzy";
          matchSource = "db_fuzzy";
          matchConfidence = fuzzy.score;
        }
      }
    }

    const matchedRow = selected ? selected.candidate : null;
    const per100g = matchedRow ? normalizePer100g(matchedRow.per_100g) : makeZeroVector();
    const per100gSum = sumPer100gVector(per100g);
    const curatedById = !!(curatedEntry && curatedEntry.fdc_id);
    const isUsable = !!matchedRow && (per100gSum > 0 || curatedById);

    const out = {
      canonical_id: item.canonical_id,
      canonical_name: item.canonical_name,
      display_name: item.display_name,
      kingdom: item.kingdom,
      domain: item.domain,
      food_group: item.food_group,
      subgroup: item.subgroup,
      default_state: item.default_state,
      aliases: Array.isArray(item.aliases) ? item.aliases : [],
      variant_template_id: item.variant_template_id,
      variant_values:
        item?.variant_values && typeof item.variant_values === "object"
          ? item.variant_values
          : {},
      notes: item.notes,
      is_canon_v1: true,
      is_usable: isUsable,
      match_status: matchStatus,
      match_source: matchSource,
      match_confidence: Number(matchConfidence.toFixed(6)),
      source: matchedRow ? matchedRow.source : "stub",
      fdc_id: matchedRow ? matchedRow.fdc_id : null,
      per_100g: per100g
    };

    const auditRow = {
      canonical_id: out.canonical_id,
      display_name: out.display_name,
      match_status: out.match_status,
      match_source: out.match_source,
      match_confidence: out.match_confidence,
      matched_name: matchedRow ? matchedRow.canonical_name : null,
      matched_fdc_id: matchedRow ? matchedRow.fdc_id : null
    };
    if (matchStatus === "curated") {
      audit.counts.curated += 1;
      audit.curated.push(auditRow);
    } else if (matchStatus === "matched") {
      audit.counts.matched += 1;
      audit.matched.push(auditRow);
    } else if (matchStatus === "fuzzy") {
      audit.counts.fuzzy += 1;
      audit.fuzzy.push(auditRow);
    } else {
      audit.counts.unmatched += 1;
      audit.unmatched.push(auditRow);
    }

    return out;
  });

  return { rows, audit };
};

const upsertChunked = async (supabase, table, rows, conflictKey) => {
  for (const part of chunk(rows, CHUNK_SIZE)) {
    const { error } = await supabase.from(table).upsert(part, {
      onConflict: conflictKey
    });
    if (error) {
      throw new Error(`Failed upsert into ${table}: ${error.message}`);
    }
  }
};

const deleteChunkedByIds = async (supabase, table, key, ids) => {
  for (const part of chunk(ids, CHUNK_SIZE)) {
    const { error } = await supabase.from(table).delete().in(key, part);
    if (error) {
      throw new Error(`Failed delete from ${table}: ${error.message}`);
    }
  }
};

const run = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.flatPath)) {
    throw new Error(`Missing flat canon file: ${options.flatPath}`);
  }
  const flatPayload = JSON.parse(fs.readFileSync(options.flatPath, "utf8"));
  const flatItems = Array.isArray(flatPayload?.items) ? flatPayload.items : [];
  if (!flatItems.length) {
    throw new Error("Flat canon payload has no items.");
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasSupabaseEnv = Boolean(supabaseUrl && supabaseServiceRoleKey);
  const supabase = hasSupabaseEnv
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
    : null;

  if (options.apply && !supabase) {
    throw new Error("Cannot use --apply without SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const currentRows = supabase ? await loadAllCanonicalRows(supabase) : [];
  const baseSourceRows =
    options.sourceUsda || !supabase
      ? loadSourceRowsFromUsdaCsvs(options.usdaDirs)
      : currentRows;
  const supplementalSourceRows = loadSupplementalSourceRows(options.supplementalSourcesPath);
  const sourceRows = mergeSourceRowsByFdcId(baseSourceRows, supplementalSourceRows);
  const curationByCanonicalId = loadCurationMap(options.curationPath);
  const { rows: reseededRows, audit } = matchCanonItems(
    flatItems,
    sourceRows,
    curationByCanonicalId,
    options.strictCuration
  );
  const strictFailures = reseededRows.filter((row) => !row.is_usable);
  if (options.strictCuration && strictFailures.length) {
    const preview = strictFailures.slice(0, 25).map((row) => row.canonical_id).join(", ");
    throw new Error(
      `Strict curation failed: ${strictFailures.length} canon items are unresolved or unusable. First 25: ${preview}`
    );
  }
  const priorityAliases = loadPriorityAliases(options.priorityAliasesPath);
  const aliasRows = buildAliasRows(reseededRows, priorityAliases);
  const variantDimensions = Array.isArray(flatPayload?.variant_dimensions)
    ? flatPayload.variant_dimensions
    : [];
  const variantTemplates = Array.isArray(flatPayload?.variant_templates)
    ? flatPayload.variant_templates
    : [];
  const variantTemplateDimensions = variantTemplates.flatMap((template) => {
    const templateId =
      typeof template?.template_id === "string" && template.template_id.trim()
        ? template.template_id.trim()
        : "";
    if (!templateId) {
      return [];
    }
    const dimensions = Array.isArray(template?.dimensions) ? template.dimensions : [];
    return dimensions
      .map((dimension) => {
        const key = typeof dimension?.key === "string" ? dimension.key.trim() : "";
        if (!key) {
          return null;
        }
        return {
          template_id: templateId,
          key,
          default_value:
            Object.prototype.hasOwnProperty.call(dimension || {}, "default") &&
            dimension.default !== undefined
              ? dimension.default
              : null
        };
      })
      .filter(Boolean);
  });

  fs.mkdirSync(path.dirname(options.auditPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.previewPath), { recursive: true });
  fs.writeFileSync(options.auditPath, `${JSON.stringify(audit, null, 2)}\n`);
  fs.writeFileSync(
    options.previewPath,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        rows: reseededRows,
        aliases: aliasRows
      },
      null,
      2
    )}\n`
  );
  console.log(`Audit written: ${options.auditPath}`);
  console.log(`Preview rows written: ${options.previewPath}`);
  console.log(
    `Match counts -> curated: ${audit.counts.curated}, matched: ${audit.counts.matched}, fuzzy: ${audit.counts.fuzzy}, unmatched: ${audit.counts.unmatched}`
  );
  console.log(`Prepared alias rows: ${aliasRows.length}`);
  console.log(`Strict curation mode: ${options.strictCuration ? "on" : "off"}`);

  if (!options.apply) {
    console.log("Dry run only. Use --apply to snapshot + replace canonical tables.");
    if (options.sourceUsda || !supabase) {
      console.log(`Source rows loaded from USDA CSV dirs: ${options.usdaDirs.join(", ")}`);
    }
    if (supplementalSourceRows.length) {
      console.log(`Loaded supplemental source rows: ${supplementalSourceRows.length}`);
    }
    if (curationByCanonicalId.size) {
      console.log(`Loaded manual curation entries: ${curationByCanonicalId.size}`);
    }
    return;
  }

  const backupRunId = `canon_v1_${new Date().toISOString().replace(/[-:.TZ]/g, "")}`;
  console.log(`Backup run id: ${backupRunId}`);

  await upsertChunked(
    supabase,
    "canonical_foods_backups",
    currentRows.map((row) => ({
      backup_run_id: backupRunId,
      canonical_id: row.canonical_id,
      canonical_row: row
    })),
    "backup_run_id,canonical_id"
  );

  const { data: existingAliasRows, error: existingAliasError } = await supabase
    .from("canonical_food_aliases")
    .select("alias, canonical_id");
  if (existingAliasError) {
    throw new Error(`Failed loading canonical_food_aliases: ${existingAliasError.message}`);
  }
  const aliasBackupRows = (Array.isArray(existingAliasRows) ? existingAliasRows : []).map((row) => ({
    backup_run_id: backupRunId,
    alias: row.alias,
    alias_row: row
  }));
  if (aliasBackupRows.length) {
    await upsertChunked(
      supabase,
      "canonical_food_aliases_backups",
      aliasBackupRows,
      "backup_run_id,alias"
    );
  }

  const incomingIdSet = new Set(reseededRows.map((row) => row.canonical_id));
  const idsToDelete = currentRows
    .map((row) => row.canonical_id)
    .filter((id) => !incomingIdSet.has(id));
  if (idsToDelete.length) {
    await deleteChunkedByIds(supabase, "canonical_foods", "canonical_id", idsToDelete);
  }

  await upsertChunked(supabase, "canonical_foods", reseededRows, "canonical_id");

  const { error: deleteAliasError } = await supabase
    .from("canonical_food_aliases")
    .delete()
    .neq("alias", "__never__");
  if (deleteAliasError) {
    throw new Error(`Failed clearing canonical_food_aliases: ${deleteAliasError.message}`);
  }
  if (aliasRows.length) {
    await upsertChunked(supabase, "canonical_food_aliases", aliasRows, "alias");
  }

  const { error: deleteTemplateDimensionsError } = await supabase
    .from("canonical_variant_template_dimensions")
    .delete()
    .neq("template_id", "__never__");
  if (deleteTemplateDimensionsError) {
    throw new Error(
      `Failed clearing canonical_variant_template_dimensions: ${deleteTemplateDimensionsError.message}`
    );
  }

  const { error: deleteTemplatesError } = await supabase
    .from("canonical_variant_templates")
    .delete()
    .neq("template_id", "__never__");
  if (deleteTemplatesError) {
    throw new Error(`Failed clearing canonical_variant_templates: ${deleteTemplatesError.message}`);
  }

  const { error: deleteDimensionsError } = await supabase
    .from("canonical_variant_dimensions")
    .delete()
    .neq("key", "__never__");
  if (deleteDimensionsError) {
    throw new Error(`Failed clearing canonical_variant_dimensions: ${deleteDimensionsError.message}`);
  }

  const normalizedDimensions = variantDimensions
    .map((entry) => {
      const key = typeof entry?.key === "string" ? entry.key.trim() : "";
      if (!key) {
        return null;
      }
      return {
        key,
        label: typeof entry?.label === "string" ? entry.label.trim() : key,
        value_type: entry?.value_type === "number" ? "number" : "enum",
        allowed_values: Array.isArray(entry?.allowed_values) ? entry.allowed_values : []
      };
    })
    .filter(Boolean);
  if (normalizedDimensions.length) {
    await upsertChunked(supabase, "canonical_variant_dimensions", normalizedDimensions, "key");
  }

  const normalizedTemplates = variantTemplates
    .map((entry) => {
      const templateId = typeof entry?.template_id === "string" ? entry.template_id.trim() : "";
      if (!templateId) {
        return null;
      }
      return {
        template_id: templateId,
        applies_to: Array.isArray(entry?.applies_to) ? entry.applies_to : []
      };
    })
    .filter(Boolean);
  if (normalizedTemplates.length) {
    await upsertChunked(
      supabase,
      "canonical_variant_templates",
      normalizedTemplates,
      "template_id"
    );
  }

  if (variantTemplateDimensions.length) {
    await upsertChunked(
      supabase,
      "canonical_variant_template_dimensions",
      variantTemplateDimensions,
      "template_id,key"
    );
  }

  console.log("Canon v1 reseed applied.");
  console.log(
    `Inserted/updated ${reseededRows.length} canonical rows and ${aliasRows.length} alias rows.`
  );
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
