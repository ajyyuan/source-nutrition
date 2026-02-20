const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

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

const DEFAULT_PREVIEW_PATH = path.resolve("data/canon/source-canon-v1.reseed-preview.json");
const DEFAULT_OUTPUT_PATH = path.resolve("data/canon/source-canon-v1.post-cutover-audit.json");
const PAGE_SIZE = 1000;

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokenize = (value) =>
  normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

const scoreCandidate = (query, candidateName) => {
  const normalizedQuery = normalizeText(query);
  const normalizedCandidate = normalizeText(candidateName);
  if (!normalizedQuery || !normalizedCandidate) {
    return 0;
  }
  let score = 0;
  if (normalizedCandidate === normalizedQuery) {
    score += 1.2;
  } else if (normalizedCandidate.startsWith(`${normalizedQuery} `)) {
    score += 0.95;
  } else if (normalizedCandidate.startsWith(normalizedQuery)) {
    score += 0.85;
  } else if (normalizedCandidate.includes(` ${normalizedQuery} `)) {
    score += 0.75;
  } else if (normalizedCandidate.includes(normalizedQuery)) {
    score += 0.6;
  }
  const queryTokens = tokenize(normalizedQuery);
  const candidateTokenSet = new Set(tokenize(normalizedCandidate));
  if (queryTokens.length && candidateTokenSet.size) {
    const overlap = queryTokens.filter((token) => candidateTokenSet.has(token)).length;
    if (overlap > 0) {
      const precision = overlap / queryTokens.length;
      const recall = overlap / candidateTokenSet.size;
      const tokenF1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
      score += tokenF1 * 0.7;
    }
  }
  return score;
};

const rankSuggestions = (query, foods, limit = 5) =>
  foods
    .map((food) => {
      const aliasScores = Array.isArray(food.aliases)
        ? food.aliases.map((alias) => scoreCandidate(query, alias))
        : [];
      return {
        canonical_id: food.canonical_id,
        canonical_name: food.canonical_name,
        lexical_score: Math.max(scoreCandidate(query, food.canonical_name), ...aliasScores, 0)
      };
    })
    .filter((row) => row.lexical_score > 0.2)
    .sort((a, b) => {
      if (b.lexical_score !== a.lexical_score) {
        return b.lexical_score - a.lexical_score;
      }
      return a.canonical_name.localeCompare(b.canonical_name);
    })
    .slice(0, limit);

const sumPer100g = (per100g) =>
  NUTRIENT_KEYS.reduce((acc, key) => {
    const value = per100g && typeof per100g[key] === "number" ? per100g[key] : 0;
    return acc + (Number.isFinite(value) ? value : 0);
  }, 0);

const parseArgs = (argv) => {
  const out = {
    previewPath: DEFAULT_PREVIEW_PATH,
    outputPath: DEFAULT_OUTPUT_PATH,
    fromDb: false
  };
  argv.forEach((arg) => {
    if (arg === "--from-db") {
      out.fromDb = true;
    } else if (arg.startsWith("--preview=")) {
      out.previewPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--out=")) {
      out.outputPath = path.resolve(arg.split("=")[1]);
    }
  });
  return out;
};

const loadRowsFromPreview = (previewPath) => {
  if (!fs.existsSync(previewPath)) {
    throw new Error(`Missing preview file: ${previewPath}`);
  }
  const payload = JSON.parse(fs.readFileSync(previewPath, "utf8"));
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const aliasRows = Array.isArray(payload?.aliases) ? payload.aliases : [];
  const aliasesById = new Map();
  aliasRows.forEach((aliasRow) => {
    const canonicalId = typeof aliasRow?.canonical_id === "string" ? aliasRow.canonical_id.trim() : "";
    const alias = typeof aliasRow?.alias === "string" ? aliasRow.alias.trim() : "";
    if (!canonicalId || !alias) {
      return;
    }
    if (!aliasesById.has(canonicalId)) {
      aliasesById.set(canonicalId, new Set());
    }
    aliasesById.get(canonicalId).add(alias);
  });
  return rows.map((row) => ({
    ...row,
    aliases: Array.from(aliasesById.get(row.canonical_id) || new Set(row.aliases || []))
  }));
};

const loadRowsFromDb = async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --from-db.");
  }
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const rows = [];
  let from = 0;
  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("canonical_foods")
      .select("canonical_id, canonical_name, aliases, per_100g, is_usable, is_canon_v1, match_status")
      .eq("is_canon_v1", true)
      .range(from, to);
    if (error) {
      throw new Error(`Failed loading canonical_foods: ${error.message}`);
    }
    if (!Array.isArray(data) || !data.length) {
      break;
    }
    rows.push(...data);
    if (data.length < PAGE_SIZE) {
      break;
    }
    from += PAGE_SIZE;
  }
  return rows;
};

const run = async () => {
  const options = parseArgs(process.argv.slice(2));
  const rows = options.fromDb ? await loadRowsFromDb() : loadRowsFromPreview(options.previewPath);
  const usableRows = rows.filter((row) => row.is_usable !== false);
  const usableZeroVectorRows = usableRows.filter(
    (row) => row.canonical_id !== "food-unknown" && sumPer100g(row.per_100g) === 0
  );
  const matchStatusCounts = rows.reduce((acc, row) => {
    const key = typeof row?.match_status === "string" ? row.match_status : "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const queries = [
    { query: "egg", expected: "Chicken egg" },
    { query: "beef liver", expected: "Beef liver" },
    { query: "parmesan", expected: "Parmesan" },
    { query: "sardine", expected: "Sardine" },
    { query: "kimchi", expected: "Kimchi" }
  ];
  const queryChecks = queries.map((entry) => {
    const suggestions = rankSuggestions(entry.query, usableRows, 5);
    const top = suggestions[0] || null;
    return {
      query: entry.query,
      expected: entry.expected,
      passed:
        !!top && normalizeText(top.canonical_name) === normalizeText(entry.expected),
      top_result: top ? top.canonical_name : null,
      top_score: top ? Number(top.lexical_score.toFixed(4)) : null,
      top5: suggestions.map((row) => row.canonical_name)
    };
  });

  const result = {
    generated_at: new Date().toISOString(),
    source: options.fromDb ? "db" : "preview",
    totals: {
      rows: rows.length,
      usable_rows: usableRows.length,
      unusable_rows: rows.length - usableRows.length,
      usable_zero_vector_rows: usableZeroVectorRows.length
    },
    match_status_counts: matchStatusCounts,
    query_checks: queryChecks
  };

  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(result, null, 2)}\n`);

  console.log(`Wrote audit report: ${options.outputPath}`);
  console.log(
    `Rows=${result.totals.rows}, usable=${result.totals.usable_rows}, usable_zero_vector=${result.totals.usable_zero_vector_rows}`
  );
  console.log(
    `Query pass rate: ${
      queryChecks.filter((check) => check.passed).length
    }/${queryChecks.length}`
  );
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
