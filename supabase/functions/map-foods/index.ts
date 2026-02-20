// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  computeMealTotals,
  computeItemTotals,
  NUTRIENT_DB_VERSION,
  sumPercentDv
} from "../_shared/nutrients.ts";
import {
  type CanonicalFoodLookupItem
} from "../_shared/lexicalFoodSearch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPPORTED_UNITS = new Set(["g", "oz", "lb", "ml", "fl oz", "cup", "tbsp", "tsp"]);
const UNKNOWN_CANONICAL_ID = "food-unknown";
const CANONICAL_PAGE_SIZE = 1000;
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

const makeZeroVector = () =>
  Object.fromEntries(NUTRIENT_KEYS.map((key) => [key, 0]));

const normalizePer100g = (value: unknown) => {
  const base = makeZeroVector();
  if (!value || typeof value !== "object") {
    return base;
  }
  NUTRIENT_KEYS.forEach((key) => {
    const raw = value[key];
    base[key] = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  });
  return base;
};

const sumPer100gVector = (per100g: Record<string, number>) =>
  NUTRIENT_KEYS.reduce((acc, key) => acc + (Number.isFinite(per100g[key]) ? per100g[key] : 0), 0);

const isSurveyFdcId = (fdcId: string) => /^2\d+/.test(fdcId);

const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const normalizeLookupKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const resolveCanonicalIdFromLookupText = (
  rawValue: string,
  canonicalLookup: CanonicalFoodLookupItem[]
) => {
  const normalized = normalizeLookupKey(rawValue);
  if (!normalized) {
    return "";
  }
  for (const candidate of canonicalLookup) {
    const lookupValues = [candidate.canonical_id, candidate.canonical_name, ...(candidate.aliases || [])];
    for (const value of lookupValues) {
      if (typeof value !== "string" || !value.trim()) {
        continue;
      }
      if (normalizeLookupKey(value) === normalized) {
        return candidate.canonical_id;
      }
    }
  }
  return "";
};

const buildCanonicalIndexes = (
  rows: Array<Record<string, unknown>>,
  aliasByCanonicalId: Map<string, Set<string>>
) => {
  const byId: Record<string, Record<string, unknown>> = {};
  const lookup: CanonicalFoodLookupItem[] = [];
  const usableIds = new Set<string>();
  rows.forEach((row) => {
    const canonicalId = typeof row?.canonical_id === "string" ? row.canonical_id.trim() : "";
    const canonicalName =
      typeof row?.canonical_name === "string" ? row.canonical_name.trim() : "";
    const fdcId = typeof row?.fdc_id === "string" ? row.fdc_id.trim() : "";
    if (!canonicalId || !canonicalName) {
      return;
    }
    const per100g = normalizePer100g(row?.per_100g);
    const per100gSum = sumPer100gVector(per100g);
    const unusableSurveyRow = isSurveyFdcId(fdcId) && per100gSum === 0;
    const usable = !unusableSurveyRow;
    const rowAliases = Array.isArray(row?.aliases)
      ? row.aliases.filter((alias) => typeof alias === "string" && alias.trim().length > 0)
      : [];
    const mergedAliases = new Set<string>(rowAliases);
    const linkedAliases = aliasByCanonicalId.get(canonicalId);
    if (linkedAliases) {
      linkedAliases.forEach((alias) => mergedAliases.add(alias));
    }
    byId[canonicalId] = {
      canonical_id: canonicalId,
      canonical_name: canonicalName,
      fdc_id: fdcId,
      per_100g: per100g,
      aliases: Array.from(mergedAliases),
      usable,
      source: row?.source === "usda" ? "usda" : "stub"
    };
    if (usable) {
      usableIds.add(canonicalId);
      lookup.push({
        canonical_id: canonicalId,
        canonical_name: canonicalName,
        aliases: Array.from(mergedAliases)
      });
    }
  });
  return { byId, lookup, usableIds };
};

const fetchAllCanonicalRows = async (supabase) => {
  const rows = [];
  let from = 0;
  while (true) {
    const to = from + CANONICAL_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("canonical_foods")
      .select("canonical_id, canonical_name, per_100g, source, fdc_id, aliases")
      .eq("is_canon_v1", true)
      .eq("is_usable", true)
      .range(from, to);
    if (error) {
      throw error;
    }
    if (!Array.isArray(data) || !data.length) {
      break;
    }
    rows.push(...data);
    if (data.length < CANONICAL_PAGE_SIZE) {
      break;
    }
    from += CANONICAL_PAGE_SIZE;
  }
  return rows;
};

const fetchAliasMap = async (
  supabase,
  canonicalIds: string[]
): Promise<Map<string, Set<string>>> => {
  const aliasMap = new Map<string, Set<string>>();
  if (!canonicalIds.length) {
    return aliasMap;
  }
  const chunks = chunkArray(canonicalIds, 500);
  for (const canonicalIdChunk of chunks) {
    try {
      const { data, error } = await supabase
        .from("canonical_food_aliases")
        .select("alias, canonical_id")
        .in("canonical_id", canonicalIdChunk);
      if (error) {
        throw error;
      }
      (Array.isArray(data) ? data : []).forEach((row) => {
        const canonicalId = typeof row?.canonical_id === "string" ? row.canonical_id.trim() : "";
        const alias = typeof row?.alias === "string" ? row.alias.trim() : "";
        if (!canonicalId || !alias) {
          return;
        }
        if (!aliasMap.has(canonicalId)) {
          aliasMap.set(canonicalId, new Set<string>());
        }
        aliasMap.get(canonicalId)?.add(alias);
      });
    } catch (_error) {
      return aliasMap;
    }
  }
  return aliasMap;
};

const loadCanonicalFoods = async (supabase) => {
  const data = await fetchAllCanonicalRows(supabase);
  if (!Array.isArray(data) || !data.length) {
    throw new Error("canonical_foods is empty. Seed canonical foods before mapping.");
  }
  const canonicalIds = data
    .map((row) => (typeof row?.canonical_id === "string" ? row.canonical_id.trim() : ""))
    .filter(Boolean);
  const aliasByCanonicalId = await fetchAliasMap(supabase, canonicalIds);
  const { byId, lookup, usableIds } = buildCanonicalIndexes(data, aliasByCanonicalId);
  if (!lookup.length) {
    throw new Error("canonical_foods has no valid rows.");
  }
  return { byId, lookup, usableIds };
};

const resolveCanonicalForItem = async (
  explicitCanonicalId: string,
  canonicalLookup: CanonicalFoodLookupItem[],
  canonicalById: Record<string, Record<string, unknown>>,
  usableIds: Set<string>
) => {
  if (!explicitCanonicalId) {
    throw new Error("Each item must include canonical_id.");
  }
  if (explicitCanonicalId === UNKNOWN_CANONICAL_ID) {
    throw new Error("food-unknown is not allowed in strict canon mode.");
  }
  if (canonicalById[explicitCanonicalId]) {
    if (!usableIds.has(explicitCanonicalId)) {
      throw new Error(`canonical_id is not usable: ${explicitCanonicalId}`);
    }
    return explicitCanonicalId;
  }
  const normalizedExplicitId = resolveCanonicalIdFromLookupText(explicitCanonicalId, canonicalLookup);
  if (normalizedExplicitId) {
    if (!usableIds.has(normalizedExplicitId)) {
      throw new Error(`canonical_id is not usable: ${normalizedExplicitId}`);
    }
    return normalizedExplicitId;
  }
  throw new Error(`Unknown canonical_id: ${explicitCanonicalId}`);
};

const createSupabaseClient = (req: Request) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are missing.");
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {}
    }
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { meal_id, items } = await req.json().catch(() => ({}));
    if (!meal_id || typeof meal_id !== "string") {
      return new Response(
        JSON.stringify({
          error: "meal_id is required"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
    const safeItems = Array.isArray(items) ? items : [];

    const supabase = createSupabaseClient(req);
    const {
      lookup: canonicalLookup,
      byId: canonicalById,
      usableIds
    } = await loadCanonicalFoods(supabase);

    const mapped = [];
    for (const item of safeItems) {
      const name = typeof item?.name === "string" ? item.name.trim() : "unknown";
      const grams =
        typeof item?.estimated_grams === "number" && Number.isFinite(item.estimated_grams)
          ? Math.max(item.estimated_grams, 0)
          : 0;
      const quantity =
        typeof item?.quantity === "number" && Number.isFinite(item.quantity)
          ? Math.max(item.quantity, 0)
          : grams;
      const unit =
        typeof item?.unit === "string" && SUPPORTED_UNITS.has(item.unit) ? item.unit : "g";
      const lastPreciseUnit =
        typeof item?.last_precise_unit === "string" && SUPPORTED_UNITS.has(item.last_precise_unit)
          ? item.last_precise_unit
          : unit;
      const confidence =
        typeof item?.confidence === "number" && item.confidence >= 0 && item.confidence <= 1
          ? item.confidence
          : 0.2;

      const explicitCanonicalId =
        typeof item?.canonical_id === "string" ? item.canonical_id.trim() : "";
      const canonicalId = await resolveCanonicalForItem(
        explicitCanonicalId,
        canonicalLookup,
        canonicalById,
        usableIds
      );
      const canonicalEntry = canonicalById[canonicalId] ?? null;
      const canonicalName =
        typeof canonicalEntry?.canonical_name === "string"
          ? canonicalEntry.canonical_name
          : name || explicitCanonicalId;
      const nutrientTotals = computeItemTotals(
        {
          canonical_id: canonicalId,
          grams
        },
        canonicalById
      );

      mapped.push({
        // Canonical selection is the display value after mapping.
        name: canonicalName,
        grams,
        canonical_id: canonicalId,
        canonical_name: canonicalName,
        quantity,
        unit,
        last_precise_unit: lastPreciseUnit,
        confidence,
        nutrient_totals: nutrientTotals
      });
    }

    const nutrient_totals = computeMealTotals(
      mapped.map((item) => ({
        canonical_id: item.canonical_id,
        grams: item.grams
      })),
      canonicalById
    );

    const top_contributors = mapped
      .map((item) => {
        const score = sumPercentDv(item.nutrient_totals.percent_dv);
        return {
          canonical_id: item.canonical_id,
          name: item.canonical_name,
          score
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const insights = {
      top_contributors
    };

    const { error: updateError } = await supabase
      .from("meals")
      .update({
        final_items: mapped,
        nutrient_totals,
        nutrient_db_version: NUTRIENT_DB_VERSION,
        insights
      })
      .eq("id", meal_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        items: mapped,
        nutrient_totals,
        nutrient_db_version: NUTRIENT_DB_VERSION,
        insights
      }),
      {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
