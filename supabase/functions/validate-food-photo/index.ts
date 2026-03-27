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
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this image. If it's NOT food/meal/drink, respond with JSON {"is_food": false, "items": []}.
If it IS food, identify visible items and estimate realistic nutrition. Respond ONLY with valid JSON:
{
  "is_food": true,
  "items": [
    {"name": "item name", "portion_g": 150, "calories": 250, "protein_g": 10, "carbs_g": 30, "fat_g": 8}
  ]
}
Rules:
- items must always be an array
- use integers for all numeric fields
- if one mixed dish is visible, return at least one item for the dish
- no markdown, no explanation, no extra keys`,
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
      const normalizedRaw = typeof raw === "string" ? raw : JSON.stringify(raw);
      const stripped = normalizedRaw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const match = stripped.match(/\{[\s\S]*\}/);
      const jsonStr = match ? match[0] : stripped;
      const parsed = JSON.parse(jsonStr);
      const items = Array.isArray(parsed.items)
        ? parsed.items
            .filter((item: Record<string, unknown>) => item && typeof item === "object")
            .map((item: Record<string, unknown>) => ({
              name: String(item.name || "Food"),
              portion_g: Math.max(0, Math.round(Number(item.portion_g) || 0)),
              calories: Math.max(0, Math.round(Number(item.calories) || 0)),
              protein_g: Math.max(0, Math.round(Number(item.protein_g) || 0)),
              carbs_g: Math.max(0, Math.round(Number(item.carbs_g) || 0)),
              fat_g: Math.max(0, Math.round(Number(item.fat_g) || 0)),
            }))
        : [];

      return new Response(JSON.stringify({
        is_food: !!parsed.is_food,
        items,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Failed to parse validate-food-photo response:", raw, error);
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
