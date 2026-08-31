import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Verify JWT — header presence alone is not enough
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");


    const body = await req.json();
    const rawPath: unknown = body?.photo_path ??
      (typeof body?.photo_url === "string" ? body.photo_url.split("?")[0].split("/food-photos/")[1] : undefined);

    if (!rawPath || typeof rawPath !== "string" || rawPath.length > 500) {
      return new Response(JSON.stringify({ error: "photo_path required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const photoPath = decodeURIComponent(rawPath);

    // Photos live under "<user_id>/..." — a client may only validate its own upload.
    if (photoPath.split("/")[0] !== userData.user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The bucket is private; sign a short-lived URL for the AI gateway to fetch.
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: signed, error: signError } = await serviceClient.storage
      .from("food-photos")
      .createSignedUrl(photoPath, 300);
    if (signError || !signed?.signedUrl) {
      console.error("Failed to sign food photo:", signError);
      return new Response(JSON.stringify({ error: "Could not read photo" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const photo_url = signed.signedUrl;


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
If it IS food, identify visible items and estimate REALISTIC nutrition based on VISIBLE portion size. Respond ONLY with valid JSON:
{
  "is_food": true,
  "items": [
    {"name": "item name", "portion_g": 150, "calories": 250, "protein_g": 10, "carbs_g": 30, "fat_g": 8}
  ]
}
CRITICAL rules for accurate estimation:
- Estimate the ACTUAL visible portion size in grams carefully. A typical plate has 200-400g of food total.
- Use standard USDA/nutritional database values per 100g, then multiply by actual portion.
- Cross-check: calories must approximately equal (protein_g * 4) + (carbs_g * 4) + (fat_g * 9). If not, fix the values.
- A typical meal is 300-700 kcal. Only exceed 800 kcal if the portion is clearly very large or calorie-dense (fried food, large pasta, etc.)
- A protein shake/smoothie is typically 150-350 kcal per serving (300-500ml)
- A salad is typically 150-400 kcal
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
            .map((item: Record<string, unknown>) => {
              const portion_g = Math.max(0, Math.min(2000, Math.round(Number(item.portion_g) || 0)));
              let calories = Math.max(0, Math.round(Number(item.calories) || 0));
              const protein_g = Math.max(0, Math.min(200, Math.round(Number(item.protein_g) || 0)));
              const carbs_g = Math.max(0, Math.min(500, Math.round(Number(item.carbs_g) || 0)));
              const fat_g = Math.max(0, Math.min(200, Math.round(Number(item.fat_g) || 0)));
              // Sanity: recalculate calories from macros if AI value is wildly off
              const macroCalc = protein_g * 4 + carbs_g * 4 + fat_g * 9;
              if (macroCalc > 0 && (calories > macroCalc * 1.5 || calories < macroCalc * 0.5)) {
                calories = macroCalc;
              }
              // Cap single item at 1500 kcal
              calories = Math.min(1500, calories);
              return { name: String(item.name || "Food"), portion_g, calories, protein_g, carbs_g, fat_g };
            })
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
