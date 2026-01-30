// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  computeMealTotals,
  computeItemTotals,
  listCanonicalFoods,
  NUTRIENT_DB_VERSION,
  sumPercentDv
} from "../_shared/nutrients.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const FALLBACK_CANONICAL_FOODS = listCanonicalFoods().filter(
  (item) => item.canonical_id !== "food-unknown"
);
const FALLBACK_CANONICAL_BY_ID = Object.fromEntries(
  listCanonicalFoods().map((item) => [item.canonical_id, item])
);
const ALIAS_MAP = {
  salmon: "salmon-cooked",
  "smoked salmon": "salmon-cooked",
  egg: "egg-whole",
  eggs: "egg-whole",
  spinach: "spinach-raw",
  "baby spinach": "spinach-raw",
  apple: "apple-raw",
  apples: "apple-raw"
};
const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const STOP_WORDS = new Set([
  "region",
  "pass",
  "sample",
  "samples",
  "composite",
  "store",
  "stores",
  "fresh",
  "raw",
  "yes",
  "no",
  "n",
  "a",
  "na",
  "n/a",
  "nf",
  "nfy"
]);
const cleanTokens = (value: string) =>
  normalizeName(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => token.length > 1)
    .filter((token) => !STOP_WORDS.has(token))
    .filter((token) => !/\d/.test(token));
const toTokenSet = (value: string) => new Set(cleanTokens(value));
const matchAlias = (normalized: string) => {
  for (const [alias, canonicalId] of Object.entries(ALIAS_MAP)) {
    if (normalized.includes(alias)) {
      return canonicalId;
    }
  }
  return null;
};
const scoreCandidate = (tokens: Set<string>, canonicalName: string) => {
  const canonicalTokens = toTokenSet(canonicalName);
  if (!canonicalTokens.size || !tokens.size) {
    return 0;
  }
  const overlap = Array.from(tokens).filter((token) => canonicalTokens.has(token)).length;
  return overlap / tokens.size;
};
const pickCanonicalId = (
  name: string,
  canonicalFoods: typeof FALLBACK_CANONICAL_FOODS
) => {
  const tokens = toTokenSet(name);
  const aliasMatch = matchAlias(normalizeName(name));
  if (aliasMatch) {
    return aliasMatch;
  }
  let bestId = "food-unknown";
  let bestScore = 0;
  canonicalFoods.forEach((candidate) => {
    const score = scoreCandidate(tokens, candidate.canonical_name);
    if (score > bestScore) {
      bestScore = score;
      bestId = candidate.canonical_id;
    }
  });
  return bestScore >= 0.5 ? bestId : "food-unknown";
};

const mergeCanonicalFoods = (rows: Array<Record<string, unknown>>) => {
  const byId = { ...FALLBACK_CANONICAL_BY_ID };
  rows.forEach((row) => {
    const canonicalId = typeof row?.canonical_id === "string" ? row.canonical_id : "";
    if (!canonicalId) {
      return;
    }
    const fallback = byId[canonicalId];
    const per_100g =
      row?.per_100g && typeof row.per_100g === "object"
        ? { ...(fallback?.per_100g ?? {}), ...row.per_100g }
        : fallback?.per_100g ?? FALLBACK_CANONICAL_BY_ID["food-unknown"].per_100g;
    byId[canonicalId] = {
      canonical_id: canonicalId,
      canonical_name:
        typeof row?.canonical_name === "string"
          ? row.canonical_name
          : fallback?.canonical_name ?? canonicalId,
      per_100g,
      source: row?.source === "usda" ? "usda" : fallback?.source ?? "stub"
    };
  });
  return {
    byId,
    foods: Object.values(byId).filter((item) => item.canonical_id !== "food-unknown")
  };
};

const loadCanonicalFoods = async (supabase) => {
  try {
    const { data, error } = await supabase
      .from("canonical_foods")
      .select("canonical_id, canonical_name, per_100g, source");
    if (error || !data?.length) {
      return {
        foods: FALLBACK_CANONICAL_FOODS,
        byId: FALLBACK_CANONICAL_BY_ID
      };
    }
    return mergeCanonicalFoods(data);
  } catch (_error) {
    return {
      foods: FALLBACK_CANONICAL_FOODS,
      byId: FALLBACK_CANONICAL_BY_ID
    };
  }
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
    const { foods: canonicalFoods, byId: canonicalById } = await loadCanonicalFoods(supabase);

    const mapped = safeItems.map((item) => {
      const name = typeof item?.name === "string" ? item.name.trim() : "unknown";
      const normalized = name.toLowerCase();
      const grams =
        typeof item?.estimated_grams === "number" && Number.isFinite(item.estimated_grams)
          ? Math.max(item.estimated_grams, 0)
          : 0;
      const confidence =
        typeof item?.confidence === "number" && item.confidence >= 0 && item.confidence <= 1
          ? item.confidence
          : 0.2;

      const canonicalId = pickCanonicalId(name || "unknown", canonicalFoods);
      const canonicalEntry = canonicalById[canonicalId];

      return {
        name,
        grams,
        canonical_id: canonicalId,
        canonical_name: (canonicalEntry?.canonical_name ?? name) || "Unknown food",
        confidence
      };
    });

    const nutrient_totals = computeMealTotals(
      mapped.map((item) => ({
        canonical_id: item.canonical_id,
        grams: item.grams
      })),
      canonicalById
    );

    const top_contributors = mapped
      .map((item) => {
        const totals = computeItemTotals(
          {
            canonical_id: item.canonical_id,
            grams: item.grams
          },
          canonicalById
        );
        const score = sumPercentDv(totals.percent_dv);
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
