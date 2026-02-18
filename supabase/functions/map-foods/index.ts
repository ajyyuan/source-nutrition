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
  rankCanonicalFoodSuggestions,
  type CanonicalFoodLookupItem,
  type CanonicalFoodSuggestion
} from "../_shared/lexicalFoodSearch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPPORTED_UNITS = new Set(["g", "oz", "lb", "ml", "fl oz", "cup", "tbsp", "tsp"]);
const OPENAI_MODEL = "gpt-4o-mini";
const UNKNOWN_CANONICAL_ID = "food-unknown";
const UNKNOWN_CANONICAL_NAME = "Unknown food";
const LEXICAL_STRONG_SCORE = 0.95;
const LEXICAL_MARGIN_TO_SKIP_AI = 0.2;
const MAX_LEXICAL_CANDIDATES = 8;
const MAX_AI_CANDIDATES = 6;
const NUTRIENT_KEYS = [
  "vitamin_a_ug",
  "vitamin_c_mg",
  "vitamin_d_ug",
  "vitamin_e_mg",
  "vitamin_k_ug",
  "thiamin_mg",
  "riboflavin_mg",
  "niacin_mg",
  "vitamin_b6_mg",
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

const buildCanonicalIndexes = (rows: Array<Record<string, unknown>>) => {
  const byId: Record<string, Record<string, unknown>> = {};
  const lookup: CanonicalFoodLookupItem[] = [];
  rows.forEach((row) => {
    const canonicalId = typeof row?.canonical_id === "string" ? row.canonical_id.trim() : "";
    const canonicalName =
      typeof row?.canonical_name === "string" ? row.canonical_name.trim() : "";
    if (!canonicalId || !canonicalName) {
      return;
    }
    byId[canonicalId] = {
      canonical_id: canonicalId,
      canonical_name: canonicalName,
      per_100g: normalizePer100g(row?.per_100g),
      source: row?.source === "usda" ? "usda" : "stub"
    };
    lookup.push({
      canonical_id: canonicalId,
      canonical_name: canonicalName
    });
  });
  return { byId, lookup };
};

const loadCanonicalFoods = async (supabase) => {
  const { data, error } = await supabase
    .from("canonical_foods")
    .select("canonical_id, canonical_name, per_100g, source");
  if (error) {
    throw error;
  }
  if (!Array.isArray(data) || !data.length) {
    throw new Error("canonical_foods is empty. Seed canonical foods before mapping.");
  }
  const { byId, lookup } = buildCanonicalIndexes(data);
  if (!lookup.length) {
    throw new Error("canonical_foods has no valid rows.");
  }
  return { byId, lookup };
};

const shouldTrustLexicalTopCandidate = (candidates: CanonicalFoodSuggestion[]) => {
  if (!candidates.length) {
    return false;
  }
  if (candidates.length === 1) {
    return true;
  }
  const top = candidates[0];
  const runnerUp = candidates[1];
  if (top.lexical_score >= 1.15) {
    return true;
  }
  return top.lexical_score >= LEXICAL_STRONG_SCORE &&
    top.lexical_score - runnerUp.lexical_score >= LEXICAL_MARGIN_TO_SKIP_AI;
};

const pickCanonicalWithAi = async (
  observedName: string,
  candidates: CanonicalFoodSuggestion[]
): Promise<string | null> => {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey || !candidates.length) {
    return null;
  }
  const candidateSubset = candidates.slice(0, MAX_AI_CANDIDATES);
  const candidateById = Object.fromEntries(
    candidateSubset.map((candidate) => [candidate.canonical_id, candidate])
  );
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Choose the best canonical food candidate for the observed food label. Return strict JSON: {\"canonical_id\":\"<candidate_id or empty string>\"}."
        },
        {
          role: "user",
          content: JSON.stringify({
            observed_name: observedName,
            candidates: candidateSubset.map((candidate) => ({
              canonical_id: candidate.canonical_id,
              canonical_name: candidate.canonical_name,
              lexical_score: candidate.lexical_score
            }))
          })
        }
      ]
    })
  });

  if (!response.ok) {
    return null;
  }
  const result = await response.json().catch(() => null);
  const content = result?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    return null;
  }
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(content);
  } catch (_error) {
    return null;
  }
  const selectedId = typeof parsed?.canonical_id === "string" ? parsed.canonical_id.trim() : "";
  return selectedId && candidateById[selectedId] ? selectedId : null;
};

const resolveCanonicalForItem = async (
  itemName: string,
  explicitCanonicalId: string,
  canonicalLookup: CanonicalFoodLookupItem[],
  canonicalById: Record<string, Record<string, unknown>>
) => {
  if (explicitCanonicalId) {
    if (!canonicalById[explicitCanonicalId]) {
      throw new Error(`Unknown canonical_id: ${explicitCanonicalId}`);
    }
    return explicitCanonicalId;
  }

  const candidates = rankCanonicalFoodSuggestions(itemName, canonicalLookup, MAX_LEXICAL_CANDIDATES);
  if (!candidates.length) {
    return UNKNOWN_CANONICAL_ID;
  }

  if (shouldTrustLexicalTopCandidate(candidates)) {
    return candidates[0].canonical_id;
  }

  const aiChoice = await pickCanonicalWithAi(itemName, candidates);
  if (aiChoice && canonicalById[aiChoice]) {
    return aiChoice;
  }
  return candidates[0].canonical_id;
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
    const { lookup: canonicalLookup, byId: canonicalById } = await loadCanonicalFoods(supabase);

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
        name || "unknown",
        explicitCanonicalId,
        canonicalLookup,
        canonicalById
      );
      const canonicalEntry = canonicalById[canonicalId] ?? null;
      const canonicalName =
        typeof canonicalEntry?.canonical_name === "string"
          ? canonicalEntry.canonical_name
          : canonicalId === UNKNOWN_CANONICAL_ID
            ? UNKNOWN_CANONICAL_NAME
            : name || UNKNOWN_CANONICAL_NAME;

      mapped.push({
        // Canonical selection is the display value after mapping.
        name: canonicalName,
        grams,
        canonical_id: canonicalId,
        canonical_name: canonicalName,
        quantity,
        unit,
        last_precise_unit: lastPreciseUnit,
        confidence
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
