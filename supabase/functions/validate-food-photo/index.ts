import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_URL_PREFIX = Deno.env.get("SUPABASE_URL")
  ? `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/food-photos/`
  : null;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { photo_url } = await req.json();
    if (!photo_url || typeof photo_url !== "string") {
      return new Response(JSON.stringify({ error: "photo_url required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (ALLOWED_URL_PREFIX && !photo_url.startsWith(ALLOWED_URL_PREFIX)) {
      return new Response(JSON.stringify({ error: "Invalid photo URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (photo_url.length > 500) {
      return new Response(JSON.stringify({ error: "URL too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this image. If it's NOT food/meal/drink, respond: {"is_food": false}
If it IS food, identify all items and estimate nutrition. Respond ONLY with JSON:
{
  "is_food": true,
  "items": [
    {"name": "item name", "portion_g": 150, "calories": 250, "protein_g": 10, "carbs_g": 30, "fat_g": 8}
  ]
}
Be concise with names. Estimate realistic portions from the photo. No other text.`,
              },
              {
                type: "image_url",
                image_url: { url: photo_url },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      return new Response(JSON.stringify({ is_food: true, items: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";

    try {
      const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const result = JSON.parse(jsonStr);
      return new Response(JSON.stringify({
        is_food: !!result.is_food,
        items: result.items || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify({ is_food: true, items: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("validate-food-photo error:", e);
    return new Response(JSON.stringify({ is_food: true, items: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
