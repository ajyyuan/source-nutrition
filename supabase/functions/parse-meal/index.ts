// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
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
const MAX_LEXICAL_CANDIDATES = 8;
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

let canonicalCache: CanonicalFoodLookupItem[] | null = null;
let canonicalCacheLoadedAt = 0;

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
You are an assistant that extracts foods from meal photos.
Return ONLY strict JSON matching this schema:
{
  "items": [
    {
      "name": "string",
      "estimated_grams": number,
      "confidence": number (0 to 1)
    }
  ]
}
Rules:
- If unsure, return fewer items, not more.
- Unknown foods should be labeled "unknown".
- Do not include any extra keys or text.
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
      .select("canonical_id, canonical_name, per_100g, fdc_id")
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

  const foods = Array.isArray(allRows)
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
          canonical_name: row.canonical_name.trim()
        }))
    : [];

  canonicalCache = foods;
  canonicalCacheLoadedAt = now;
  return foods;
};

const resolveCanonicalFromName = (
  observedName: string,
  canonicalFoods: CanonicalFoodLookupItem[]
) => {
  const trimmedName = observedName.trim();
  if (!trimmedName || trimmedName.toLowerCase() === "unknown") {
    return {
      canonical_id: UNKNOWN_CANONICAL_ID,
      canonical_name: UNKNOWN_CANONICAL_NAME
    };
  }
  const candidates = rankCanonicalFoodSuggestions(
    trimmedName,
    canonicalFoods,
    MAX_LEXICAL_CANDIDATES
  );
  if (!candidates.length) {
    return {
      canonical_id: UNKNOWN_CANONICAL_ID,
      canonical_name: UNKNOWN_CANONICAL_NAME
    };
  }
  return {
    canonical_id: candidates[0].canonical_id,
    canonical_name: candidates[0].canonical_name
  };
};

const parseItems = (payload: string) => {
  const parsed = JSON.parse(payload);
  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  return items
    .map((item) => {
      const name = typeof item?.name === "string" ? item.name.trim() : "";
      const estimated = typeof item?.estimated_grams === "number" ? item.estimated_grams : NaN;
      const confidence = typeof item?.confidence === "number" ? item.confidence : NaN;
      if (!name || !Number.isFinite(estimated) || !Number.isFinite(confidence)) {
        return null;
      }
      if (confidence < 0 || confidence > 1) {
        return null;
      }
      return {
        name,
        estimated_grams: Math.max(estimated, 0),
        confidence
      };
    })
    .filter(Boolean);
};

const callVisionModel = async (imageBase64: string, contentType: string) => {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    throw new Error("OPENAI_API_KEY is not set for parse-meal.");
  }

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
                "Identify foods in this meal photo. Return JSON only with name, estimated_grams, confidence."
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
    let items: unknown[] = [];
    let parseWarning: string | null = null;
    try {
      const parsedItems = await callVisionModel(base64, contentType);
      items = parsedItems.map((item) => {
        const canonical = resolveCanonicalFromName(item.name, canonicalFoods);
        return {
          ...item,
          canonical_id: canonical.canonical_id,
          canonical_name: canonical.canonical_name
        };
      });
    } catch (error) {
      parseWarning = error instanceof Error ? error.message : "Vision model failed.";
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
        error: parseWarning ?? undefined
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
