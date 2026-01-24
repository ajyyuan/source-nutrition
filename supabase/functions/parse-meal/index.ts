// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

const MODEL_VERSION = "stub-v0";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { meal_id, photo_path } = await req.json().catch(() => ({}));
    if (!meal_id || !photo_path) {
      return new Response(JSON.stringify({ error: "meal_id and photo_path required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Stub payload for Day 2 testing
    const items = [
      { name: "unknown food", estimated_grams: 150, confidence: 0.25 }
    ];

    const supabase = createSupabaseClient(req);
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

    return new Response(JSON.stringify({ items, model_version: MODEL_VERSION }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
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
