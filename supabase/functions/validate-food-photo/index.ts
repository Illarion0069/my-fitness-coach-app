import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { photo_url } = await req.json();
    if (!photo_url) {
      return new Response(JSON.stringify({ error: "photo_url required" }), {
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
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: 'Is this a photo of food, a meal, a drink, or something food-related? Answer ONLY with JSON: {"is_food": true} or {"is_food": false}. No other text.',
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
      // On AI error, allow the photo (fail open)
      return new Response(JSON.stringify({ is_food: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";

    try {
      const jsonStr = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const result = JSON.parse(jsonStr);
      return new Response(JSON.stringify({ is_food: !!result.is_food }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      // If can't parse, allow the photo
      return new Response(JSON.stringify({ is_food: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e) {
    console.error("validate-food-photo error:", e);
    // Fail open - allow photo
    return new Response(JSON.stringify({ is_food: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
