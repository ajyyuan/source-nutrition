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

let canonicalCache: CanonicalFoodLookupItem[] | null = null;
let canonicalCacheLoadedAt = 0;

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

  const { data, error } = await supabase
    .from("canonical_foods")
    .select("canonical_id, canonical_name")
    .limit(5000);

  if (error) {
    throw error;
  }

  const foods = Array.isArray(data)
    ? data
        .filter(
          (row) =>
            typeof row?.canonical_id === "string" &&
            row.canonical_id.trim().length > 0 &&
            typeof row?.canonical_name === "string" &&
            row.canonical_name.trim().length > 0
        )
        .map((row) => ({
          canonical_id: row.canonical_id.trim(),
          canonical_name: row.canonical_name.trim()
        }))
    : [];

  if (!foods.length) {
    throw new Error("canonical_foods is empty. Seed canonical foods first.");
  }

  canonicalCache = foods;
  canonicalCacheLoadedAt = now;
  return foods;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query, limit } = await req.json().catch(() => ({}));
    const trimmedQuery = typeof query === "string" ? query.trim() : "";
    if (!trimmedQuery || trimmedQuery.length < 2) {
      return new Response(
        JSON.stringify({
          items: []
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const suggestionLimit =
      typeof limit === "number" && Number.isFinite(limit) ? Math.round(limit) : 8;
    const supabase = createSupabaseClient(req);
    const canonicalFoods = await loadCanonicalFoods(supabase);
    const items = rankCanonicalFoodSuggestions(trimmedQuery, canonicalFoods, suggestionLimit);

    return new Response(
      JSON.stringify({
        items
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        items: [],
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
