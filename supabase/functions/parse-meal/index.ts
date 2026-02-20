// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type CanonicalFoodLookupItem
} from "../_shared/lexicalFoodSearch.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

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

const MODEL_VERSION = "gpt-4o-mini";
const PHOTO_BUCKET = "meal-photos";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const CANONICAL_CACHE_TTL_MS = 60_000;
const CANONICAL_PAGE_SIZE = 1000;
const UNKNOWN_CANONICAL_ID = "food-unknown";
const UNKNOWN_CANONICAL_NAME = "Unknown food";
const MAX_CANON_CONTEXT_ITEMS = 350;
const MAX_ALIASES_PER_ITEM = 4;
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

let canonicalCache: CanonicalFoodLookupItem[] | null = null;
let canonicalCacheLoadedAt = 0;

const normalizeLookupKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const fetchMealPhoto = async (supabase, photoPath: string) => {
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(photoPath);
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("Meal photo not found.");
  }
  const buffer = await data.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new Error("Meal photo is empty.");
  }
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Meal photo is too large to process (max 12MB).");
  }
  const contentType = data.type || "image/jpeg";
  return {
    contentType,
    base64: base64Encode(new Uint8Array(buffer))
  };
};

const SYSTEM_PROMPT = `
You are an assistant that extracts foods from meal photos and must map each item to a provided canonical catalog.
Return ONLY strict JSON matching this schema:
{
  "items": [
    {
      "name": "string",
      "canonical_id": "string",
      "estimated_grams": number,
      "confidence": number (0 to 1)
    }
  ]
}
Rules:
- canonical_id MUST be one of the provided catalog canonical_id values.
- Set name to the chosen canonical label (not a free-form observed synonym).
- Return fewer items rather than uncertain ones.
- Do NOT return "food-unknown". Omit uncertain foods instead.
- Choose the single best canonical item from the catalog for each detected food.
- Do not invent new canonical ids or canonical names.
- If unsure, return fewer items, not more.
- Do not include extra keys or text.
`.trim();

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
    // Keep parse-time canonicalization online even when alias metadata is unavailable.
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

const buildCanonicalLookup = (canonicalFoods: CanonicalFoodLookupItem[]) => {
  const byId = new Map<string, CanonicalFoodLookupItem>();
  const byNormalizedLabel = new Map<string, CanonicalFoodLookupItem>();
  canonicalFoods.forEach((food) => {
    byId.set(food.canonical_id, food);
    const lookupValues = [food.canonical_id, food.canonical_name, ...(food.aliases || [])];
    lookupValues.forEach((value) => {
      if (typeof value !== "string" || !value.trim()) {
        return;
      }
      const normalized = normalizeLookupKey(value);
      if (!normalized || byNormalizedLabel.has(normalized)) {
        return;
      }
      byNormalizedLabel.set(normalized, food);
    });
  });
  return { byId, byNormalizedLabel };
};

const buildCanonContext = (canonicalFoods: CanonicalFoodLookupItem[]) =>
  canonicalFoods
    .filter((food) => food.canonical_id !== UNKNOWN_CANONICAL_ID)
    .slice(0, MAX_CANON_CONTEXT_ITEMS)
    .map((food) => ({
    canonical_id: food.canonical_id,
    canonical_name: food.canonical_name,
    aliases: Array.isArray(food.aliases)
      ? food.aliases.filter((alias) => typeof alias === "string").slice(0, MAX_ALIASES_PER_ITEM)
      : []
    }));

const parseItems = (payload: string) => {
  const parsed = JSON.parse(payload);
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  return items
    .map((item) => {
      const name = typeof item?.name === "string" ? item.name.trim() : "";
      const canonicalId = typeof item?.canonical_id === "string" ? item.canonical_id.trim() : "";
      const estimated = typeof item?.estimated_grams === "number" ? item.estimated_grams : NaN;
      const confidence = typeof item?.confidence === "number" ? item.confidence : NaN;
      if (!name || !canonicalId || !Number.isFinite(estimated) || !Number.isFinite(confidence)) {
        return null;
      }
      if (confidence < 0 || confidence > 1) {
        return null;
      }
      return {
        name,
        canonical_id: canonicalId,
        estimated_grams: Math.max(estimated, 0),
        confidence
      };
    })
    .filter(Boolean);
};

const callVisionModel = async (
  imageBase64: string,
  contentType: string,
  canonicalFoods: CanonicalFoodLookupItem[]
) => {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY is not set for parse-meal.");
  }
  const catalogContext = buildCanonContext(canonicalFoods);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL_VERSION,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Identify foods in this meal photo and classify each one to a canonical_id from the provided catalog.\n\nCatalog:\n${JSON.stringify(catalogContext)}\n\nReturn JSON only with name, canonical_id, estimated_grams, confidence. Omit uncertain foods instead of outputting unknowns.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${contentType};base64,${imageBase64}`,
                detail: "low"
              }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vision model error: ${errorText}`);
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Vision model response was empty.");
  }
  return parseItems(content);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { meal_id, photo_path } = await req.json().catch(() => ({}));
    if (!meal_id || !photo_path) {
      return new Response(
        JSON.stringify({
          items: [],
          model_version: MODEL_VERSION,
          error: "meal_id and photo_path required"
        }),
        {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const supabase = createSupabaseClient(req);
    const { contentType, base64 } = await fetchMealPhoto(supabase, photo_path);
    const canonicalFoods = await loadCanonicalFoods(supabase);
    const canonicalLookup = buildCanonicalLookup(canonicalFoods);
    let items: unknown[] = [];
    let parseWarning: string | null = null;
    let parseError: string | null = null;
    try {
      const parsedItems = await callVisionModel(base64, contentType, canonicalFoods);
      let omittedCount = 0;
      const strictItems = parsedItems.flatMap((item) => {
        const modelCanonical =
          canonicalLookup.byId.get(item.canonical_id) ||
          canonicalLookup.byNormalizedLabel.get(normalizeLookupKey(item.canonical_id));
        if (!modelCanonical || modelCanonical.canonical_id === UNKNOWN_CANONICAL_ID) {
          omittedCount += 1;
          return [];
        }
        return [{
          ...item,
          name: modelCanonical.canonical_name,
          canonical_id: modelCanonical.canonical_id,
          canonical_name: modelCanonical.canonical_name
        }];
      });
      items = strictItems;
      if (omittedCount > 0) {
        parseWarning = `Omitted ${omittedCount} uncertain item${omittedCount === 1 ? "" : "s"} that could not be confidently mapped.`;
      }
    } catch (error) {
      parseError = error instanceof Error ? error.message : "Vision model failed.";
      items = [];
    }

    const { error: updateError } = await supabase
      .from("meals")
      .update({
        parsed_items: items,
        model_version: MODEL_VERSION
      })
      .eq("id", meal_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        items,
        model_version: MODEL_VERSION,
        warning: parseWarning ?? undefined,
        error: parseError ?? undefined
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
        model_version: MODEL_VERSION,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
