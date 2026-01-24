// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  computeMealTotals,
  NUTRIENT_DB_VERSION
} from "../_shared/nutrients.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { items } = await req.json().catch(() => ({}));
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

      let canonicalId = "food-unknown";
      if (normalized.includes("apple")) {
        canonicalId = "apple-raw";
      } else if (normalized.includes("spinach")) {
        canonicalId = "spinach-raw";
      } else if (normalized.includes("salmon")) {
        canonicalId = "salmon-cooked";
      } else if (normalized.includes("egg")) {
        canonicalId = "egg-whole";
      }

      return {
        name,
        grams,
        canonical_id: canonicalId,
        canonical_name: name || "Unknown food",
        confidence
      };
    });

    const nutrient_totals = computeMealTotals(
      mapped.map((item) => ({
        canonical_id: item.canonical_id,
        grams: item.grams
      }))
    );

    return new Response(
      JSON.stringify({
        items: mapped,
        nutrient_totals,
        nutrient_db_version: NUTRIENT_DB_VERSION
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
