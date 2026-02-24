const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

const DEFAULT_FLAT_INPUT = path.resolve("data/canon/source-canon-v1.flat.json");
const DEFAULT_OUTPUT = path.resolve("data/canon/source-canon-v1.manual-curation.json");
const DEFAULT_CANDIDATES_OUTPUT = path.resolve("data/canon/source-canon-v1.curation-candidates.json");
const DEFAULT_USDA_DIRS = [
  path.resolve("data/FoodData_Central_sr_legacy_food_csv_2018-04"),
  path.resolve("data/FoodData_Central_foundation_food_csv_2025-12-18"),
  path.resolve("data/FoodData_Central_survey_food_csv_2022-10-28")
];
const MIN_ACCEPT_SCORE = 0.65;

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

const sumPer100g = (per100g) =>
  NUTRIENT_KEYS.reduce((acc, key) => acc + (Number.isFinite(per100g[key]) ? per100g[key] : 0), 0);

const parseArgs = (argv) => {
  const options = {
    flatPath: DEFAULT_FLAT_INPUT,
    outPath: DEFAULT_OUTPUT,
    candidatesOutPath: DEFAULT_CANDIDATES_OUTPUT,
    usdaDirs: DEFAULT_USDA_DIRS
  };
  argv.forEach((arg) => {
    if (arg.startsWith("--flat=")) {
      options.flatPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--out=")) {
      options.outPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--candidates-out=")) {
      options.candidatesOutPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--usda-dirs=")) {
      const raw = arg.split("=")[1];
      options.usdaDirs = raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => path.resolve(entry));
    }
  });
  return options;
};

const readCsv = (filePath) =>
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
  const sourceTag = path.basename(usdaDir).replace(/^FoodData_Central_/, "").replace(/_csv_.+$/, "");
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
      source_dataset: sourceTag,
      per_100g: makeZeroVector(),
      _nutrient_priority: {},
      _omega3_components: {},
      _omega3_component_priority: {}
    });
  });
  foodNutrientRows.forEach((row) => {
    const fdcId = String(row[nutrientCols.fdcId] || "").trim();
    const nutrientId = String(row[nutrientCols.nutrientId] || "").trim();
    if (!fdcId || !foodsById.has(fdcId)) {
      return;
    }
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

  return Array.from(foodsById.values())
    .map((row) => {
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
      const cleaned = Object.fromEntries(
        Object.entries(row).filter(
          ([key]) =>
            key !== "_nutrient_priority" &&
            key !== "_omega3_components" &&
            key !== "_omega3_component_priority"
        )
      );
      return {
        ...cleaned,
        per_100g: normalizePer100g(cleaned.per_100g)
      };
    })
    .filter((row) => sumPer100g(row.per_100g) > 0);
};

const loadAllSourceRows = (usdaDirs) => {
  const rowsByFdc = new Map();
  usdaDirs.forEach((dir) => {
    const rows = loadSourceRowsFromUsdaCsv(dir);
    rows.forEach((row) => {
      const existing = rowsByFdc.get(row.fdc_id);
      if (!existing || sumPer100g(row.per_100g) > sumPer100g(existing.per_100g)) {
        rowsByFdc.set(row.fdc_id, row);
      }
    });
  });
  return Array.from(rowsByFdc.values());
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
  const candidateTokens = new Set(tokenize(candidateName));
  const presentSpecies = SPECIES_TOKENS.filter((token) => candidateTokens.has(token));

  if (!normalizedCandidate) {
    return { passed: false, reason: "empty_candidate", score: -Infinity, lexical: 0 };
  }
  if (/restaurant|fast food|tv dinner|frozen dinner|baby food/.test(normalizedCandidate)) {
    return { passed: false, reason: "processed_food_row", score: -Infinity, lexical: 0 };
  }

  if (rules.speciesExpected.length) {
    const hasExpectedSpecies = rules.speciesExpected.some((token) => candidateTokens.has(token));
    if (!hasExpectedSpecies) {
      return { passed: false, reason: "species_mismatch", score: -Infinity, lexical: 0 };
    }
    if (presentSpecies.length && !presentSpecies.some((token) => rules.speciesExpected.includes(token))) {
      return { passed: false, reason: "different_species_present", score: -Infinity, lexical: 0 };
    }
  }

  if (rules.expectsGround) {
    const hasGroundWord =
      candidateTokens.has("ground") || candidateTokens.has("mince") || candidateTokens.has("minced");
    if (!hasGroundWord) {
      return { passed: false, reason: "ground_required", score: -Infinity, lexical: 0 };
    }
  }

  if (rules.expectedFatPercent) {
    const hasFatPercent =
      normalizedCandidate.includes(`${rules.expectedFatPercent}% fat`) ||
      normalizedCandidate.includes(`/${rules.expectedFatPercent} fat`) ||
      normalizedCandidate.includes(` ${rules.expectedFatPercent} fat`);
    if (!hasFatPercent) {
      return { passed: false, reason: "fat_percent_mismatch", score: -Infinity, lexical: 0 };
    }
  }

  if (rules.expectsScrambled && !candidateTokens.has("scrambled")) {
    return { passed: false, reason: "scrambled_required", score: -Infinity, lexical: 0 };
  }
  if (rules.expectsFried && !candidateTokens.has("fried")) {
    return { passed: false, reason: "fried_required", score: -Infinity, lexical: 0 };
  }

  if (rules.rawPreferred) {
    const hasCookedToken = COOKED_TOKENS.some((token) => candidateTokens.has(token));
    if (hasCookedToken) {
      return { passed: false, reason: "raw_required", score: -Infinity, lexical: 0 };
    }
  }

  if (!rules.expectsOrgan && ORGAN_TOKENS.some((token) => candidateTokens.has(token))) {
    return { passed: false, reason: "unexpected_organ", score: -Infinity, lexical: 0 };
  }

  if (rules.rejectEggOnly && candidateTokens.has("egg")) {
    return { passed: false, reason: "unexpected_egg_row", score: -Infinity, lexical: 0 };
  }

  const lexical = Math.max(
    scoreCandidate(rules.itemName, candidateName),
    ...rules.aliases.map((alias) => scoreCandidate(alias, candidateName)),
    0
  );
  let score = lexical;
  const matchedExpectedCount = rules.expectedTokens.filter((token) => candidateTokens.has(token)).length;
  const expectedCount = rules.expectedTokens.length;

  score += matchedExpectedCount * 0.08;

  if (rules.speciesExpected.length) {
    score += 0.12;
  }
  if (rules.expectedFatPercent) {
    score += 0.2;
  }
  if (rules.expectsGround) {
    score += 0.08;
  }
  if (rules.rawPreferred && candidateTokens.has("raw")) {
    score += 0.1;
  }

  return {
    passed: true,
    reason: "accepted",
    score,
    lexical,
    matched_expected_count: matchedExpectedCount,
    expected_count: expectedCount
  };
};

const confidenceLabel = (score) => {
  if (score >= 1.3) return "high";
  if (score >= MIN_ACCEPT_SCORE) return "medium";
  return "low";
};

const run = () => {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.flatPath)) {
    throw new Error(`Missing flat canon file: ${options.flatPath}`);
  }
  const flatPayload = JSON.parse(fs.readFileSync(options.flatPath, "utf8"));
  const flatItems = Array.isArray(flatPayload?.items) ? flatPayload.items : [];
  if (!flatItems.length) {
    throw new Error("Flat canon payload has no items.");
  }

  const sourceRows = loadAllSourceRows(options.usdaDirs);
  const matches = [];
  const candidatesReport = [];

  flatItems.forEach((item) => {
    const rules = deriveRules(item);
    const ranked = sourceRows
      .map((candidate) => {
        const evaluation = evaluateCandidate(rules, candidate.canonical_name);
        const safeScore = Number.isFinite(evaluation.score) ? evaluation.score : -9999;
        const safeLexical = Number.isFinite(evaluation.lexical) ? evaluation.lexical : 0;
        const matchedExpectedCount = Number.isFinite(evaluation.matched_expected_count)
          ? evaluation.matched_expected_count
          : 0;
        const expectedCount = Number.isFinite(evaluation.expected_count) ? evaluation.expected_count : 0;
        const expectedTokenCoverage = expectedCount > 0 ? matchedExpectedCount / expectedCount : 0;
        return {
          fdc_id: candidate.fdc_id,
          source_dataset: candidate.source_dataset,
          canonical_name: candidate.canonical_name,
          score: Number(safeScore.toFixed(6)),
          lexical_score: Number(safeLexical.toFixed(6)),
          expected_token_coverage: Number(expectedTokenCoverage.toFixed(6)),
          accepted: evaluation.passed,
          reason: evaluation.reason,
          expected_tokens: rules.expectedTokens,
          expected_species: rules.speciesExpected
        };
      })
      .filter((candidate) => candidate.accepted)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    const top = ranked[0] || null;
    const topAcceptable =
      !!top &&
      (top.score >= MIN_ACCEPT_SCORE ||
        (top.expected_token_coverage >= 0.75 && top.lexical_score >= 0.38 && top.score >= 0.55));
    const selected = topAcceptable
      ? {
          canonical_id: item.canonical_id,
          canonical_name: item.canonical_name,
          fdc_id: top.fdc_id,
          source_dataset: top.source_dataset,
          source_name: top.canonical_name,
          confidence: confidenceLabel(top.score),
          score: top.score,
          notes: "Candidate selected under strict token/species/prep constraints."
        }
      : {
          canonical_id: item.canonical_id,
          canonical_name: item.canonical_name,
          fdc_id: null,
          source_dataset: null,
          source_name: null,
          confidence: "low",
          score: 0,
          notes: top ? "Top candidate below strict acceptance threshold." : "No acceptable candidate found."
        };

    matches.push(selected);
    candidatesReport.push({
      canonical_id: item.canonical_id,
      canonical_name: item.canonical_name,
      rules,
      selected,
      top_candidates: ranked
    });
  });

  const unresolved = matches.filter((entry) => !entry.fdc_id);
  const lowConfidence = matches.filter((entry) => entry.confidence === "low");
  const output = {
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    source_policy: "Manual curation required. This file is a draft starting point.",
    source_datasets: options.usdaDirs,
    summary: {
      total_items: matches.length,
      unresolved_count: unresolved.length,
      low_confidence_count: lowConfidence.length
    },
    matches
  };
  const candidatesOutput = {
    generated_at: new Date().toISOString(),
    source_datasets: options.usdaDirs,
    items: candidatesReport
  };

  fs.mkdirSync(path.dirname(options.outPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.candidatesOutPath), { recursive: true });
  fs.writeFileSync(options.outPath, `${JSON.stringify(output, null, 2)}\n`);
  fs.writeFileSync(options.candidatesOutPath, `${JSON.stringify(candidatesOutput, null, 2)}\n`);
  console.log(`Wrote curation draft: ${options.outPath}`);
  console.log(`Wrote curation candidates: ${options.candidatesOutPath}`);
  console.log(
    `Draft coverage -> total: ${matches.length}, unresolved: ${unresolved.length}, low_confidence: ${lowConfidence.length}`
  );
};

run();
