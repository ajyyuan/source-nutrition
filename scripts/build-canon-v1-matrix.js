const fs = require("fs");
const path = require("path");

const NUTRIENT_SPECS = [
  { key: "vitamin_a_ug", label: "Vitamin A", unit: "ug" },
  { key: "vitamin_c_mg", label: "Vitamin C", unit: "mg" },
  { key: "vitamin_d_ug", label: "Vitamin D", unit: "ug" },
  { key: "vitamin_e_mg", label: "Vitamin E", unit: "mg" },
  { key: "vitamin_k_ug", label: "Vitamin K", unit: "ug" },
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

const DEFAULT_PREVIEW_PATH = path.resolve("data/canon/source-canon-v1.reseed-preview.json");
const DEFAULT_MATRIX_OUT = path.resolve("data/canon/source-canon-v1.micronutrient-matrix.csv");
const DEFAULT_COVERAGE_OUT = path.resolve("data/canon/source-canon-v1.micronutrient-coverage.csv");
const DEFAULT_SUMMARY_OUT = path.resolve(
  "data/canon/source-canon-v1.micronutrient-coverage-summary.json"
);

const parseArgs = (argv) => {
  const out = {
    previewPath: DEFAULT_PREVIEW_PATH,
    matrixOutPath: DEFAULT_MATRIX_OUT,
    coverageOutPath: DEFAULT_COVERAGE_OUT,
    summaryOutPath: DEFAULT_SUMMARY_OUT
  };
  argv.forEach((arg) => {
    if (arg.startsWith("--preview=")) {
      out.previewPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--matrix-out=")) {
      out.matrixOutPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--coverage-out=")) {
      out.coverageOutPath = path.resolve(arg.split("=")[1]);
    } else if (arg.startsWith("--summary-out=")) {
      out.summaryOutPath = path.resolve(arg.split("=")[1]);
    }
  });
  return out;
};

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

const buildMatrixRows = (rows) => {
  const headers = getFoodColumnHeaders(rows);
  const matrix = [["nutrient_key", "nutrient_label", "unit", ...headers]];
  NUTRIENT_SPECS.forEach((nutrient) => {
    const row = [nutrient.key, nutrient.label, nutrient.unit];
    rows.forEach((foodRow) => {
      const per100g = foodRow?.per_100g || {};
      row.push(asNumber(per100g[nutrient.key]));
    });
    matrix.push(row);
  });
  return matrix;
};

const buildCoverageRows = (rows) => {
  const coverage = rows.map((row) => {
    const per100g = row?.per_100g || {};
    const nonZeroNutrients = NUTRIENT_SPECS.filter((nutrient) => asNumber(per100g[nutrient.key]) > 0).length;
    const missingNutrients = NUTRIENT_SPECS.filter((nutrient) => asNumber(per100g[nutrient.key]) <= 0).map(
      (nutrient) => nutrient.key
    );
    return {
      canonical_id: String(row?.canonical_id || "").trim(),
      canonical_name: String(row?.canonical_name || row?.display_name || "").trim(),
      domain: String(row?.domain || "").trim(),
      food_group: String(row?.food_group || "").trim(),
      fdc_id: String(row?.fdc_id || "").trim(),
      source: String(row?.source || "").trim(),
      match_status: String(row?.match_status || "").trim(),
      nonzero_nutrients: nonZeroNutrients,
      total_nutrients: NUTRIENT_SPECS.length,
      coverage_ratio: Number((nonZeroNutrients / NUTRIENT_SPECS.length).toFixed(4)),
      missing_nutrient_keys: missingNutrients.join("|")
    };
  });

  coverage.sort((a, b) => {
    if (a.nonzero_nutrients !== b.nonzero_nutrients) {
      return a.nonzero_nutrients - b.nonzero_nutrients;
    }
    return a.canonical_name.localeCompare(b.canonical_name);
  });

  const rowsOut = [
    [
      "canonical_id",
      "canonical_name",
      "domain",
      "food_group",
      "fdc_id",
      "source",
      "match_status",
      "nonzero_nutrients",
      "total_nutrients",
      "coverage_ratio",
      "missing_nutrient_keys"
    ]
  ];
  coverage.forEach((entry) => {
    rowsOut.push([
      entry.canonical_id,
      entry.canonical_name,
      entry.domain,
      entry.food_group,
      entry.fdc_id,
      entry.source,
      entry.match_status,
      entry.nonzero_nutrients,
      entry.total_nutrients,
      entry.coverage_ratio,
      entry.missing_nutrient_keys
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
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  if (!rows.length) {
    throw new Error("Reseed preview file has no rows.");
  }

  const matrixRows = buildMatrixRows(rows);
  const { rowsOut: coverageRows, coverage } = buildCoverageRows(rows);

  const summary = {
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    input_preview_path: options.previewPath,
    totals: {
      foods: rows.length,
      nutrients: NUTRIENT_SPECS.length,
      foods_with_zero_nonzero_nutrients: coverage.filter((row) => row.nonzero_nutrients === 0).length,
      foods_with_low_nonzero_nutrients_1_or_2: coverage.filter(
        (row) => row.nonzero_nutrients > 0 && row.nonzero_nutrients <= 2
      ).length
    },
    by_domain_low_coverage: Object.values(
      coverage.reduce((acc, row) => {
        const key = row.domain || "unknown";
        if (!acc[key]) {
          acc[key] = {
            domain: key,
            total: 0,
            low_coverage_1_or_2: 0,
            zero_coverage: 0
          };
        }
        acc[key].total += 1;
        if (row.nonzero_nutrients === 0) {
          acc[key].zero_coverage += 1;
        }
        if (row.nonzero_nutrients > 0 && row.nonzero_nutrients <= 2) {
          acc[key].low_coverage_1_or_2 += 1;
        }
        return acc;
      }, {})
    ).sort((a, b) => b.low_coverage_1_or_2 - a.low_coverage_1_or_2 || b.zero_coverage - a.zero_coverage),
    lowest_coverage_foods: coverage.slice(0, 30)
  };

  fs.mkdirSync(path.dirname(options.matrixOutPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.coverageOutPath), { recursive: true });
  fs.mkdirSync(path.dirname(options.summaryOutPath), { recursive: true });

  fs.writeFileSync(options.matrixOutPath, toCsv(matrixRows));
  fs.writeFileSync(options.coverageOutPath, toCsv(coverageRows));
  fs.writeFileSync(options.summaryOutPath, `${JSON.stringify(summary, null, 2)}\n`);

  console.log(`Wrote micronutrient matrix CSV: ${options.matrixOutPath}`);
  console.log(`Wrote coverage CSV: ${options.coverageOutPath}`);
  console.log(`Wrote coverage summary JSON: ${options.summaryOutPath}`);
  console.log(
    `Foods=${summary.totals.foods}, nutrients=${summary.totals.nutrients}, zero_coverage=${summary.totals.foods_with_zero_nonzero_nutrients}, low_coverage_1_or_2=${summary.totals.foods_with_low_nonzero_nutrients_1_or_2}`
  );
};

run();
