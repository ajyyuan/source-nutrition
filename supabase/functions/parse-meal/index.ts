// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

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
    throw new Error("Meal photo is too large to process.");
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
    let items: unknown[] = [];
    let parseWarning: string | null = null;
    try {
      items = await callVisionModel(base64, contentType);
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
