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
    // Require valid JWT (prevents anonymous abuse of Lovable AI quota)
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

    const { query, lang } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Cap query length to prevent prompt-injection / token abuse
    const safeQuery = query.trim().slice(0, 100);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");


    const systemPrompt = `You are a nutrition database. Given a food search query, return 5-8 specific food variations with accurate nutritional data per 100g serving.

Response format (JSON only, no markdown):
{
  "suggestions": [
    {
      "name_ru": "Кальмары варёные",
      "name_en": "Boiled squid",
      "portion_g": 100,
      "calories": 110,
      "protein_g": 18,
      "carbs_g": 2,
      "fat_g": 4
    }
  ]
}

CRITICAL accuracy rules:
- Use USDA/standard nutritional database values ONLY. Do NOT guess or inflate.
- All values MUST be per 100g
- Cross-check: calories ≈ (protein_g × 4) + (carbs_g × 4) + (fat_g × 9). Fix if mismatch.
- Reference values per 100g: chicken breast ~165kcal, rice ~130kcal, bread ~265kcal, banana ~89kcal, protein powder ~370kcal, milk ~42kcal, egg ~155kcal, butter ~717kcal, olive oil ~884kcal
- A protein shake (powder+water) is ~80-120 kcal per 100g (not 300+!)
- Include different cooking methods when applicable
- Sort by most common/popular first
- Names should be concise (2-4 words)
- If query is in Russian, prioritize Russian food names; if in English, use English names. Always provide both.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Search: "${safeQuery}" (user language: ${lang === "en" ? "en" : "ru"})` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    let result;
    try {
      const jsonStr = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      result = JSON.parse(jsonStr);
      // Sanity-check each suggestion
      if (Array.isArray(result.suggestions)) {
        result.suggestions = result.suggestions.map((s: any) => {
          const protein_g = Math.max(0, Math.min(100, Math.round(Number(s.protein_g) || 0)));
          const carbs_g = Math.max(0, Math.min(100, Math.round(Number(s.carbs_g) || 0)));
          const fat_g = Math.max(0, Math.min(100, Math.round(Number(s.fat_g) || 0)));
          let calories = Math.max(0, Math.round(Number(s.calories) || 0));
          // Recalculate from macros if off by >50%
          const macroCalc = protein_g * 4 + carbs_g * 4 + fat_g * 9;
          if (macroCalc > 0 && (calories > macroCalc * 1.5 || calories < macroCalc * 0.5)) {
            calories = macroCalc;
          }
          // Per-100g cap at 900 (pure fat is ~884)
          calories = Math.min(900, calories);
          return { ...s, calories, protein_g, carbs_g, fat_g, portion_g: 100 };
        });
      }
    } catch {
      result = { suggestions: [] };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("food-suggest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", suggestions: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
