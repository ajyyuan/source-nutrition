const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const DEFAULT_FLAT_PATH = path.resolve("data/canon/source-canon-v1.flat.json");
const DEFAULT_CURATION_PATH = path.resolve("data/canon/source-canon-v1.manual-curation.json");
const DEFAULT_SUPPLEMENTAL_SOURCES_PATH = path.resolve(
  "data/canon/source-canon-v1.supplemental-source-rows.json"
);
const DEFAULT_REPORT_PATH = path.resolve("data/canon/source-canon-v1.vitamin-coverage-fix-report.json");
const DEFAULT_USDA_DIRS = [
  path.resolve("data/FoodData_Central_sr_legacy_food_csv_2018-04"),
  path.resolve("data/FoodData_Central_foundation_food_csv_2025-12-18"),
  path.resolve("data/FoodData_Central_survey_food_csv_2022-10-28")
];

const NON_BIOTIN_VITAMIN_KEYS = [
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
  "folate_ug",
  "vitamin_b12_ug"
];

const NUTRIENT_KEYS = [
  ...NON_BIOTIN_VITAMIN_KEYS,
  "vitamin_b7_ug",
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

const SPECIES_TOKENS = [
  "beef",
  "bison",
  "lamb",
  "goat",
  "pork",
  "chicken",
  "turkey",
  "duck",
  "salmon",
  "tuna",
  "sardine",
  "cod",
  "haddock",
  "pollock",
  "halibut",
  "mackerel",
  "herring",
  "trout",
  "tilapia",
  "catfish",
  "anchovy",
  "shrimp",
  "prawn",
  "scallop",
  "mussel",
  "clam",
  "oyster",
  "crab",
  "lobster",
  "squid",
  "octopus"
];

const STOP_TOKENS = new Set([
  "raw",
  "fresh",
  "plain",
  "fat",
  "lean",
  "food",
  "foods",
  "meat",
  "meats",
  "cuts",
  "animal",
  "animals",
  "and",
  "or",
  "with",
  "without",
  "for",
  "to",
  "of"
]);

const ORGAN_TOKENS = [
  "liver",
  "heart",
  "kidney",
  "tongue",
  "brain",
  "spleen",
  "pancreas",
  "thymus",
  "tripe",
  "gizzard"
];

const COOKED_TOKENS = [
  "cooked",
  "roasted",
  "fried",
  "baked",
  "grilled",
  "boiled",
  "braised",
  "smoked",
  "stewed"
];
const MIN_ACCEPT_SCORE = 0.65;
const CUT_CONFLICT_TOKENS = new Set([
  "breast",
  "thigh",
  "drumstick",
  "wing",
  "tenderloin",
  "sirloin",
  "loin",
  "flank",
  "skirt",
  "chuck",
  "brisket",
  "shank",
  "belly",
  "shoulder",
  "leg",
  "rack",
  "chop",
  "jowl",
  "oxtail",
  "plate",
  "round",
  "ribs",
  "rib",
  "backribs",
  "tenders",
  "tender"
]);

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

const parseCsv = (filePath) =>
  parse(fs.readFileSync(filePath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true
  });

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
    if (!id) return;
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

const deriveSourceDatasetFromDir = (usdaDir) => {
  const sourceTag = path.basename(usdaDir).replace(/^FoodData_Central_/, "").replace(/_csv_.+$/, "");
  if (sourceTag === "sr_legacy_food" || sourceTag === "foundation_food" || sourceTag === "survey_food") {
    return sourceTag;
  }
  return sourceTag;
};

const loadUsdaRows = (usdaDirs) => {
  const rows = [];
  usdaDirs.forEach((usdaDir) => {
    const dataset = deriveSourceDatasetFromDir(usdaDir);
    const foodPath = path.join(usdaDir, "food.csv");
    const nutrientPath = path.join(usdaDir, "nutrient.csv");
    const foodNutrientPath = path.join(usdaDir, "food_nutrient.csv");
    if (!fs.existsSync(foodPath) || !fs.existsSync(nutrientPath) || !fs.existsSync(foodNutrientPath)) {
      throw new Error(
        `Missing USDA csv files in ${usdaDir}. Expected food.csv, nutrient.csv, food_nutrient.csv.`
      );
    }

    const foodRows = parseCsv(foodPath);
    const nutrientRows = parseCsv(nutrientPath);
    const foodNutrientRows = parseCsv(foodNutrientPath);

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

    const byFdcId = new Map();
    foodRows.forEach((row) => {
      const fdcId = String(row[foodCols.fdcId] || "").trim();
      const name = String(row[foodCols.description] || "").trim();
      if (!fdcId || !name) return;
      byFdcId.set(fdcId, {
        source_dataset: dataset,
        source_name: name,
        fdc_id: fdcId,
        per_100g: makeZeroVector(),
        reported: new Set(),
        nutrient_priority: {},
        omega3_components: {},
        omega3_component_priority: {}
      });
    });
    foodNutrientRows.forEach((row) => {
      const fdcId = String(row[nutrientCols.fdcId] || "").trim();
      if (!fdcId || !byFdcId.has(fdcId)) return;
      const nutrientId = String(row[nutrientCols.nutrientId] || "").trim();
      const mapped = nutrientLookup.get(nutrientId);
      if (!mapped) return;
      const amount = Number(row[nutrientCols.amount]);
      if (!Number.isFinite(amount)) return;
      const convertedAmount = amount * mapped.factor;
      if (!Number.isFinite(convertedAmount)) return;
      const target = byFdcId.get(fdcId);
      if (mapped.key === "omega3_g" && mapped.omega3_component) {
        const currentComponentPriority = Number.isFinite(
          target.omega3_component_priority[mapped.omega3_component]
        )
          ? target.omega3_component_priority[mapped.omega3_component]
          : -Infinity;
        if (mapped.priority >= currentComponentPriority) {
          target.omega3_components[mapped.omega3_component] = convertedAmount;
          target.omega3_component_priority[mapped.omega3_component] = mapped.priority;
        }
        return;
      }
      const currentPriority = Number.isFinite(target.nutrient_priority[mapped.key])
        ? target.nutrient_priority[mapped.key]
        : -Infinity;
      if (mapped.priority >= currentPriority) {
        target.per_100g[mapped.key] = convertedAmount;
        target.nutrient_priority[mapped.key] = mapped.priority;
      }
      target.reported.add(mapped.key);
    });
    byFdcId.forEach((row) => {
      if (
        !Number.isFinite(row.nutrient_priority.omega3_g) &&
        Object.keys(row.omega3_components).length > 0
      ) {
        row.per_100g.omega3_g = Object.values(row.omega3_components).reduce(
          (acc, value) => acc + (Number.isFinite(value) ? value : 0),
          0
        );
        row.nutrient_priority.omega3_g = 0;
        row.reported.add("omega3_g");
      }
      delete row.nutrient_priority;
      delete row.omega3_components;
      delete row.omega3_component_priority;
      rows.push(row);
    });
  });
  return rows;
};

const loadSupplementalRows = (supplementalSourcesPath) => {
  if (!supplementalSourcesPath || !fs.existsSync(supplementalSourcesPath)) {
    return [];
  }
  const payload = JSON.parse(fs.readFileSync(supplementalSourcesPath, "utf8"));
  const sourceRows = Array.isArray(payload?.rows) ? payload.rows : [];
  return sourceRows
    .map((row) => {
      const fdcId = String(row?.fdc_id || "").trim();
      if (!fdcId) return null;
      const sourceDataset = String(row?.source_dataset || "supplemental").trim();
      const sourceName = String(row?.source_name || row?.canonical_name || fdcId).trim();
      const rawPer100g = row?.per_100g && typeof row.per_100g === "object" ? row.per_100g : {};
      const per100g = makeZeroVector();
      const reported = new Set();
      NUTRIENT_KEYS.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(rawPer100g, key)) {
          per100g[key] = Number.isFinite(Number(rawPer100g[key])) ? Number(rawPer100g[key]) : 0;
          reported.add(key);
        }
      });
      return {
        source_dataset: sourceDataset,
        source_name: sourceName,
        fdc_id: fdcId,
        per_100g: per100g,
        reported
      };
    })
    .filter(Boolean);
};

const scoreCandidate = (query, candidateName) => {
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
  return score;
};

const deriveRules = (item) => {
  const itemName = item.canonical_name || item.display_name || "";
  const aliases = Array.isArray(item.aliases) ? item.aliases : [];
  const allItemTokens = [
    ...tokenize(itemName),
    ...tokenize(item.canonical_id || ""),
    ...tokenize(item.food_group || ""),
    ...tokenize(item.subgroup || "")
  ];
  const speciesExpected = Array.from(new Set(allItemTokens.filter((token) => SPECIES_TOKENS.includes(token))));
  const expectedTokens = Array.from(
    new Set(
      [...tokenize(itemName), ...tokenize(item.canonical_id || "")].filter(
        (token) => !STOP_TOKENS.has(token) && !/^\d+$/.test(token)
      )
    )
  );
  const fatMatch = /(\d+)\s*fat/.exec(normalize(itemName));
  const expectedFatPercent = fatMatch ? fatMatch[1] : null;
  const expectsGround = expectedTokens.includes("ground");
  const expectsEgg = expectedTokens.includes("egg");
  const expectsScrambled = expectedTokens.includes("scrambled");
  const expectsFried = expectedTokens.includes("fried");
  const expectsOrgan = ORGAN_TOKENS.some((token) => expectedTokens.includes(token));
  const rawPreferred = item.default_state === "raw" && !expectsScrambled && !expectsFried;
  const rejectEggOnly = !expectsEgg;
  return {
    itemName,
    aliases,
    speciesExpected,
    expectedTokens,
    expectedFatPercent,
    expectsGround,
    expectsEgg,
    expectsScrambled,
    expectsFried,
    expectsOrgan,
    rawPreferred,
    rejectEggOnly
  };
};

const evaluateCandidate = (rules, candidateName) => {
  const normalizedCandidate = normalize(candidateName);
  const candidateTokenList = tokenize(candidateName);
  const candidateTokens = new Set(candidateTokenList);
  const presentSpecies = SPECIES_TOKENS.filter((token) => candidateTokens.has(token));

  if (!normalizedCandidate) {
    return { passed: false, score: -Infinity, lexical: 0 };
  }
  if (/restaurant|fast food|tv dinner|frozen dinner|baby food/.test(normalizedCandidate)) {
    return { passed: false, score: -Infinity, lexical: 0 };
  }
  const hardDisallowed = [
    "nectar",
    "spread",
    "imitation",
    "luncheon",
    "sausage",
    "braunschweiger",
    "buttermilk",
    "dried",
    "prepared",
    "mix",
    "graham"
  ];
  if (hardDisallowed.some((token) => candidateTokens.has(token) && !rules.expectedTokens.includes(token))) {
    return { passed: false, score: -Infinity, lexical: 0 };
  }
  const processDisallowedIfRaw = [
    "breaded",
    "deli",
    "prepackaged",
    "seasoned",
    "canned",
    "condensed",
    "dried"
  ];
  if (
    rules.rawPreferred &&
    processDisallowedIfRaw.some((token) => candidateTokens.has(token) && !rules.expectedTokens.includes(token))
  ) {
    return { passed: false, score: -Infinity, lexical: 0 };
  }

  const leadingTokens = candidateTokenList.slice(0, 3);
  const hasLeadingAnchor =
    !rules.expectedTokens.length ||
    leadingTokens.some(
      (token) => rules.expectedTokens.includes(token) || rules.speciesExpected.includes(token)
    );
  if (!hasLeadingAnchor) {
    return { passed: false, score: -Infinity, lexical: 0 };
  }

  const expectedCutTokens = rules.expectedTokens.filter((token) => CUT_CONFLICT_TOKENS.has(token));
  if (expectedCutTokens.length) {
    const conflictingCut = Array.from(candidateTokens).find(
      (token) => CUT_CONFLICT_TOKENS.has(token) && !expectedCutTokens.includes(token)
    );
    if (conflictingCut) {
      return { passed: false, score: -Infinity, lexical: 0 };
    }
  }

  if (rules.speciesExpected.length) {
    const hasExpectedSpecies = rules.speciesExpected.some((token) => candidateTokens.has(token));
    if (!hasExpectedSpecies) return { passed: false, score: -Infinity, lexical: 0 };
    if (presentSpecies.length && !presentSpecies.some((token) => rules.speciesExpected.includes(token))) {
      return { passed: false, score: -Infinity, lexical: 0 };
    }
  }

  if (rules.expectsGround) {
    const hasGroundWord =
      candidateTokens.has("ground") || candidateTokens.has("mince") || candidateTokens.has("minced");
    if (!hasGroundWord) return { passed: false, score: -Infinity, lexical: 0 };
  }

  if (rules.expectedFatPercent) {
    const hasFatPercent =
      normalizedCandidate.includes(`${rules.expectedFatPercent}% fat`) ||
      normalizedCandidate.includes(`/${rules.expectedFatPercent} fat`) ||
      normalizedCandidate.includes(` ${rules.expectedFatPercent} fat`);
    if (!hasFatPercent) return { passed: false, score: -Infinity, lexical: 0 };
  }

  if (rules.expectsScrambled && !candidateTokens.has("scrambled")) {
    return { passed: false, score: -Infinity, lexical: 0 };
  }
  if (rules.expectsFried && !candidateTokens.has("fried")) {
    return { passed: false, score: -Infinity, lexical: 0 };
  }

  if (rules.rawPreferred) {
    const hasCookedToken = COOKED_TOKENS.some((token) => candidateTokens.has(token));
    if (hasCookedToken) return { passed: false, score: -Infinity, lexical: 0 };
    if (rules.speciesExpected.length) {
      const hasRawSignal = candidateTokens.has("raw") || candidateTokens.has("uncooked");
      if (!hasRawSignal) return { passed: false, score: -Infinity, lexical: 0 };
    }
  }

  if (!rules.expectsOrgan && ORGAN_TOKENS.some((token) => candidateTokens.has(token))) {
    return { passed: false, score: -Infinity, lexical: 0 };
  }
  if (rules.rejectEggOnly && candidateTokens.has("egg")) {
    return { passed: false, score: -Infinity, lexical: 0 };
  }

  const lexical = Math.max(
    scoreCandidate(rules.itemName, candidateName),
    ...rules.aliases.map((alias) => scoreCandidate(alias, candidateName)),
    0
  );
  let score = lexical;
  const matchedExpectedCount = rules.expectedTokens.filter((token) => candidateTokens.has(token)).length;
  score += matchedExpectedCount * 0.08;
  if (rules.speciesExpected.length) score += 0.12;
  if (rules.expectedFatPercent) score += 0.2;
  if (rules.expectsGround) score += 0.08;
  if (rules.rawPreferred && candidateTokens.has("raw")) score += 0.1;

  const expectedCount = rules.expectedTokens.length;
  const expectedTokenCoverage = expectedCount > 0 ? matchedExpectedCount / expectedCount : 0;

  return { passed: true, score, lexical, expectedTokenCoverage };
};

const parseArgs = (argv) => {
  const out = {
    flatPath: DEFAULT_FLAT_PATH,
    curationPath: DEFAULT_CURATION_PATH,
    supplementalSourcesPath: DEFAULT_SUPPLEMENTAL_SOURCES_PATH,
    usdaDirs: DEFAULT_USDA_DIRS,
    reportPath: DEFAULT_REPORT_PATH,
    apply: false
  };
  argv.forEach((arg) => {
    if (arg === "--apply") {
      out.apply = true;
    } else if (arg.startsWith("--flat=")) {
      out.flatPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--curation=")) {
      out.curationPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--supplemental-sources=")) {
      out.supplementalSourcesPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--report=")) {
      out.reportPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--usda-dirs=")) {
      out.usdaDirs = arg
        .split("=")[1]
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => path.resolve(entry));
    }
  });
  return out;
};

const vitaminReportedCount = (reportedSet) =>
  NON_BIOTIN_VITAMIN_KEYS.filter((key) => reportedSet && reportedSet.has(key)).length;

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
  const curationMatches = Array.isArray(curationPayload?.matches) ? curationPayload.matches : [];
  const curationByCanonicalId = new Map(
    curationMatches.map((entry) => [String(entry?.canonical_id || "").trim(), entry]).filter(([id]) => id)
  );

  const sourceRows = [...loadUsdaRows(options.usdaDirs), ...loadSupplementalRows(options.supplementalSourcesPath)];
  const dedupedRowsByDatasetFdc = new Map();
  sourceRows.forEach((row) => {
    const dataset = String(row?.source_dataset || "").trim();
    const fdcId = String(row?.fdc_id || "").trim();
    if (!dataset || !fdcId) return;
    const key = `${dataset}::${fdcId}`;
    const existing = dedupedRowsByDatasetFdc.get(key);
    if (!existing) {
      dedupedRowsByDatasetFdc.set(key, row);
      return;
    }
    if (vitaminReportedCount(row.reported) > vitaminReportedCount(existing.reported)) {
      dedupedRowsByDatasetFdc.set(key, row);
    }
  });
  const uniqueRows = Array.from(dedupedRowsByDatasetFdc.values());

  const recommendations = [];
  let upgradedCount = 0;
  flatItems.forEach((item) => {
    const canonicalId = String(item?.canonical_id || "").trim();
    if (!canonicalId) return;
    const current = curationByCanonicalId.get(canonicalId);
    if (!current) return;

    const currentDataset = String(current?.source_dataset || "").trim();
    const currentFdcId = String(current?.fdc_id || "").trim();
    const currentSourceRow = dedupedRowsByDatasetFdc.get(`${currentDataset}::${currentFdcId}`) || null;
    const currentVitaminCount = vitaminReportedCount(currentSourceRow?.reported);
    if (currentVitaminCount >= NON_BIOTIN_VITAMIN_KEYS.length) {
      return;
    }

    const rules = deriveRules(item);
    const scoredCandidates = uniqueRows
      .map((candidate) => {
        const evaluation = evaluateCandidate(rules, candidate.source_name);
        if (!evaluation.passed) return null;
        const candidateVitaminCount = vitaminReportedCount(candidate.reported);
        const missingVitaminKeys = NON_BIOTIN_VITAMIN_KEYS.filter((key) => !candidate.reported.has(key));
        const extraTieBreaker = (candidate.reported && candidate.reported.has("vitamin_b7_ug") ? 1 : 0) * 0.01;
        return {
          dataset: candidate.source_dataset,
          fdc_id: candidate.fdc_id,
          source_name: candidate.source_name,
          lexical_score: Number(evaluation.lexical.toFixed(6)),
          base_score: Number(evaluation.score.toFixed(6)),
          expected_token_coverage: Number(evaluation.expectedTokenCoverage.toFixed(6)),
          vitamin_reported_count: candidateVitaminCount,
          missing_vitamin_keys: missingVitaminKeys,
          rank_score: candidateVitaminCount * 100 + evaluation.score + extraTieBreaker
        };
      })
      .filter(Boolean);

    if (!scoredCandidates.length) {
      recommendations.push({
        canonical_id: canonicalId,
        canonical_name: item.canonical_name,
        current_dataset: currentDataset,
        current_fdc_id: currentFdcId,
        current_vitamin_reported_count: currentVitaminCount,
        action: "no_candidate"
      });
      return;
    }

    const rankedCandidates = scoredCandidates
      .filter((candidate) => {
        const strongMatch = candidate.base_score >= MIN_ACCEPT_SCORE;
        const fallbackMatch =
          candidate.expected_token_coverage >= 0.75 &&
          candidate.lexical_score >= 0.2 &&
          candidate.base_score >= 0.5;
        return strongMatch || fallbackMatch;
      })
      .sort((a, b) => b.rank_score - a.rank_score)
      .slice(0, 12);

    const best = rankedCandidates[0] || null;
    if (!best) {
      recommendations.push({
        canonical_id: canonicalId,
        canonical_name: item.canonical_name,
        current_dataset: currentDataset,
        current_fdc_id: currentFdcId,
        current_vitamin_reported_count: currentVitaminCount,
        action: "no_candidate"
      });
      return;
    }

    const isUpgrade = best.vitamin_reported_count > currentVitaminCount;
    recommendations.push({
      canonical_id: canonicalId,
      canonical_name: item.canonical_name,
      current_dataset: currentDataset,
      current_fdc_id: currentFdcId,
      current_source_name: current.source_name,
      current_vitamin_reported_count: currentVitaminCount,
      best_candidate: best,
      action: isUpgrade ? "upgrade" : "no_improvement",
      top_candidates: rankedCandidates
    });

    if (!isUpgrade) return;

    current.fdc_id = best.fdc_id;
    current.source_dataset = best.dataset;
    current.source_name = best.source_name;
    current.confidence = "medium";
    current.score = Number(best.base_score.toFixed(6));
    current.notes =
      "Vitamin coverage pass: remapped to source row with stronger non-biotin vitamin reporting under strict token/species/prep constraints.";
    upgradedCount += 1;
  });

  curationPayload.generated_at = new Date().toISOString();
  curationPayload.matches = curationMatches;

  const report = {
    generated_at: new Date().toISOString(),
    targets_considered: recommendations.length,
    upgraded_count: recommendations.filter((row) => row.action === "upgrade").length,
    no_improvement_count: recommendations.filter((row) => row.action === "no_improvement").length,
    no_candidate_count: recommendations.filter((row) => row.action === "no_candidate").length,
    recommendations
  };

  fs.mkdirSync(path.dirname(options.reportPath), { recursive: true });
  fs.writeFileSync(options.reportPath, `${JSON.stringify(report, null, 2)}\n`);
  if (options.apply) {
    fs.writeFileSync(options.curationPath, `${JSON.stringify(curationPayload, null, 2)}\n`);
  }

  console.log(`Wrote vitamin coverage report: ${options.reportPath}`);
  console.log(
    `Targets=${report.targets_considered}, upgrades=${report.upgraded_count}, no_improvement=${report.no_improvement_count}, no_candidate=${report.no_candidate_count}`
  );
  if (options.apply) {
    console.log(`Applied ${upgradedCount} curation upgrades to: ${options.curationPath}`);
  } else {
    console.log("Dry run only. Re-run with --apply to update manual curation.");
  }
};

run();
