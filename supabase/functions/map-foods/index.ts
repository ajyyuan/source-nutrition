// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type CanonicalFoodLookupItem } from "../_shared/lexicalFoodSearch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPPORTED_UNITS = new Set(["g", "oz", "lb", "ml", "fl oz", "cup", "tbsp", "tsp"]);
const UNKNOWN_CANONICAL_ID = "food-unknown";
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

type CanonLookupItem = {
  canonical_id: string;
  canonical_name: string;
  aliases: string[];
  usable: boolean;
};

const buildCanonicalIndexesFromLookup = (
  items: CanonLookupItem[]
): {
  byId: Record<string, { canonical_id: string; canonical_name: string; aliases: string[] }>;
  lookup: CanonicalFoodLookupItem[];
  usableIds: Set<string>;
} => {
  const byId: Record<string, { canonical_id: string; canonical_name: string; aliases: string[] }> = {};
  const lookup: CanonicalFoodLookupItem[] = [];
  const usableIds = new Set<string>();
  for (const row of items) {
    const canonicalId = typeof row?.canonical_id === "string" ? row.canonical_id.trim() : "";
    const canonicalName =
      typeof row?.canonical_name === "string" ? row.canonical_name.trim() : "";
    if (!canonicalId || !canonicalName) continue;
    const aliases = Array.isArray(row?.aliases)
      ? row.aliases.filter((a: unknown) => typeof a === "string" && (a as string).trim().length > 0)
      : [];
    const usable = Boolean(row?.usable);
    byId[canonicalId] = { canonical_id: canonicalId, canonical_name: canonicalName, aliases };
    if (usable) {
      usableIds.add(canonicalId);
      lookup.push({ canonical_id: canonicalId, canonical_name: canonicalName, aliases });
    }
  }
  return { byId, lookup, usableIds };
};

let cachedLookup: {
  byId: Record<string, { canonical_id: string; canonical_name: string; aliases: string[] }>;
  lookup: CanonicalFoodLookupItem[];
  usableIds: Set<string>;
} | null = null;

const loadCanonicalLookup = async (): Promise<{
  byId: Record<string, { canonical_id: string; canonical_name: string; aliases: string[] }>;
  lookup: CanonicalFoodLookupItem[];
  usableIds: Set<string>;
}> => {
  if (cachedLookup) return cachedLookup;
  const url = new URL("./canon-lookup.json", import.meta.url);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load canon-lookup.json: ${res.status}`);
  }
  const items = (await res.json()) as CanonLookupItem[];
  if (!Array.isArray(items) || !items.length) {
    throw new Error("canon-lookup.json is empty. Run npm run canon:lookup.");
  }
  cachedLookup = buildCanonicalIndexesFromLookup(items);
  if (!cachedLookup.lookup.length) {
    throw new Error("canon-lookup.json has no usable rows.");
  }
  return cachedLookup;
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
    } = await loadCanonicalLookup();

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

      mapped.push({
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

    const { error: updateError } = await supabase
      .from("meals")
      .update({ final_items: mapped })
      .eq("id", meal_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ items: mapped }),
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
