// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  rankCanonicalFoodSuggestions,
  type CanonicalFoodLookupItem
} from "../_shared/lexicalFoodSearch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const CANONICAL_CACHE_TTL_MS = 60_000;
const CANONICAL_PAGE_SIZE = 1000;
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

let canonicalCache: CanonicalFoodLookupItem[] | null = null;
let canonicalCacheLoadedAt = 0;

const sumPer100gVector = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return 0;
  }
  return NUTRIENT_KEYS.reduce((acc, key) => {
    const raw = value[key];
    return acc + (typeof raw === "number" && Number.isFinite(raw) ? raw : 0);
  }, 0);
};

const isSurveyFdcId = (fdcId: string) => /^2\d+/.test(fdcId);

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

const loadCanonicalFoods = async (supabase): Promise<CanonicalFoodLookupItem[]> => {
  const now = Date.now();
  if (canonicalCache && now - canonicalCacheLoadedAt < CANONICAL_CACHE_TTL_MS) {
    return canonicalCache;
  }

  const allRows = [];
  let from = 0;
  while (true) {
    const to = from + CANONICAL_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("canonical_foods")
      .select("canonical_id, canonical_name, per_100g, fdc_id, aliases")
      .eq("is_canon_v1", true)
      .eq("is_usable", true)
      .range(from, to);
    if (error) {
      throw error;
    }
    if (!Array.isArray(data) || !data.length) {
      break;
    }
    allRows.push(...data);
    if (data.length < CANONICAL_PAGE_SIZE) {
      break;
    }
    from += CANONICAL_PAGE_SIZE;
  }

  const baseFoods = Array.isArray(allRows)
    ? allRows
        .filter(
          (row) =>
            typeof row?.canonical_id === "string" &&
            row.canonical_id.trim().length > 0 &&
            typeof row?.canonical_name === "string" &&
            row.canonical_name.trim().length > 0 &&
            !(
              isSurveyFdcId(typeof row?.fdc_id === "string" ? row.fdc_id.trim() : "") &&
              sumPer100gVector(row?.per_100g) === 0
            )
        )
        .map((row) => ({
          canonical_id: row.canonical_id.trim(),
          canonical_name: row.canonical_name.trim(),
          aliases: Array.isArray(row?.aliases)
            ? row.aliases.filter((alias) => typeof alias === "string" && alias.trim().length > 0)
            : []
        }))
    : [];

  if (!baseFoods.length) {
    throw new Error("canonical_foods is empty. Seed canonical foods first.");
  }

  const aliasByCanonicalId = new Map<string, Set<string>>();
  baseFoods.forEach((food) => {
    aliasByCanonicalId.set(food.canonical_id, new Set(food.aliases || []));
  });

  try {
    const canonicalIds = baseFoods.map((food) => food.canonical_id);
    const { data: aliasRows, error: aliasError } = await supabase
      .from("canonical_food_aliases")
      .select("alias, canonical_id")
      .in("canonical_id", canonicalIds);
    if (aliasError) {
      throw aliasError;
    }
    (Array.isArray(aliasRows) ? aliasRows : []).forEach((row) => {
      const canonicalId = typeof row?.canonical_id === "string" ? row.canonical_id.trim() : "";
      const alias = typeof row?.alias === "string" ? row.alias.trim() : "";
      if (!canonicalId || !alias) {
        return;
      }
      if (!aliasByCanonicalId.has(canonicalId)) {
        aliasByCanonicalId.set(canonicalId, new Set());
      }
      aliasByCanonicalId.get(canonicalId)?.add(alias);
    });
  } catch (_error) {
    // Keep canonical lookup functional even if alias metadata is unavailable.
  }

  const foods = baseFoods.map((food) => ({
    canonical_id: food.canonical_id,
    canonical_name: food.canonical_name,
    aliases: Array.from(aliasByCanonicalId.get(food.canonical_id) || [])
  }));

  canonicalCache = foods;
  canonicalCacheLoadedAt = now;
  return foods;
};

const safeJsonResponse = (body: { items: unknown[]; error?: string }) => {
  try {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (_e) {
    return new Response('{"items":[],"error":"Internal error"}', {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const query = body && typeof body === "object" && "query" in body ? body.query : undefined;
    const limit = body && typeof body === "object" && "limit" in body ? body.limit : undefined;
    const trimmedQuery = typeof query === "string" ? query.trim() : "";
    if (!trimmedQuery || trimmedQuery.length < 2) {
      return safeJsonResponse({ items: [] });
    }

    const suggestionLimit =
      typeof limit === "number" && Number.isFinite(limit) ? Math.round(limit) : 8;
    const supabase = createSupabaseClient(req);
    const canonicalFoods = await loadCanonicalFoods(supabase);
    const items = rankCanonicalFoodSuggestions(trimmedQuery, canonicalFoods, suggestionLimit);

    return safeJsonResponse({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return safeJsonResponse({ items: [], error: message });
  }
});
