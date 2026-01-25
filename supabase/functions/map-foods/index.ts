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

const CANONICAL_FOODS = listCanonicalFoods().filter(
  (item) => item.canonical_id !== "food-unknown"
);
const CANONICAL_BY_ID = Object.fromEntries(
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
const toTokenSet = (value: string) => new Set(normalizeName(value).split(" ").filter(Boolean));
const matchAlias = (normalized: string) => {
  for (const [alias, canonicalId] of Object.entries(ALIAS_MAP)) {
    if (normalized.includes(alias)) {
      return canonicalId;
    }
  }
  return null;
};
const scoreCandidate = (normalized: string, tokens: Set<string>, canonicalName: string) => {
  const canonicalNormalized = normalizeName(canonicalName);
  const canonicalTokens = toTokenSet(canonicalName);
  if (!canonicalNormalized || !canonicalTokens.size) {
    return 0;
  }
  let score = 0;
  if (normalized.includes(canonicalNormalized)) {
    score += 0.6;
  }
  const overlap = Array.from(canonicalTokens).filter((token) => tokens.has(token)).length;
  score += 0.4 * (overlap / canonicalTokens.size);
  return score;
};
const pickCanonicalId = (name: string) => {
  const normalized = normalizeName(name);
  const tokens = toTokenSet(name);
  const aliasMatch = matchAlias(normalized);
  if (aliasMatch) {
    return aliasMatch;
  }
  let bestId = "food-unknown";
  let bestScore = 0;
  CANONICAL_FOODS.forEach((candidate) => {
    const score = scoreCandidate(normalized, tokens, candidate.canonical_name);
    if (score > bestScore) {
      bestScore = score;
      bestId = candidate.canonical_id;
    }
  });
  return bestScore >= 0.35 ? bestId : "food-unknown";
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

      const canonicalId = pickCanonicalId(name || "unknown");
      const canonicalEntry = CANONICAL_BY_ID[canonicalId];

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
      }))
    );

    const top_contributors = mapped
      .map((item) => {
        const totals = computeItemTotals({
          canonical_id: item.canonical_id,
          grams: item.grams
        });
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

    const supabase = createSupabaseClient(req);
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
