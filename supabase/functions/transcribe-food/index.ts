import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // ~60s of opus is far below this
const ALLOWED_FORMATS = ["webm", "m4a", "mp4", "mp3", "wav", "ogg", "aac", "flac"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const systemPrompt = `You convert a person's description of what they ate into a structured food list.

Return ONLY valid JSON, no markdown:
{
  "transcript": "verbatim text of what the user said (or the text they typed)",
  "items": [
    {"name": "Scrambled eggs", "portion_g": 150, "calories": 220, "protein_g": 18, "carbs_g": 2, "fat_g": 16}
  ]
}

Rules:
- Split the description into separate food items. One dish = one item.
- If the person names an amount ("three eggs", "200 grams of rice", "a large cappuccino"), use it to compute portion_g.
- If no amount is given, assume a realistic standard portion for that food.
- Use USDA/standard nutrition values. Never inflate.
- Cross-check: calories ≈ protein_g*4 + carbs_g*4 + fat_g*9. Fix mismatches.
- Reference per 100g: chicken breast ~165kcal, rice cooked ~130kcal, bread ~265kcal, banana ~89kcal, egg ~155kcal, olive oil ~884kcal, milk ~42kcal.
- Integers only for numeric fields.
- "name" must be in the user's language (ru or en, given below).
- If the description contains no food at all, return {"transcript": "...", "items": []}.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body = await req.json().catch(() => ({}));
    const lang = body?.lang === "en" ? "en" : "ru";
    const text = typeof body?.text === "string" ? body.text.trim().slice(0, 1000) : "";
    const audioB64 = typeof body?.audio_base64 === "string" ? body.audio_base64 : "";
    const rawFormat = typeof body?.format === "string" ? body.format.toLowerCase() : "webm";
    const format = ALLOWED_FORMATS.includes(rawFormat) ? (rawFormat === "mp4" ? "m4a" : rawFormat) : "webm";

    if (!audioB64 && text.length < 2) {
      return json({ error: "Nothing to transcribe", transcript: "", items: [] }, 400);
    }
    // base64 length ≈ bytes * 4/3
    if (audioB64 && audioB64.length > (MAX_AUDIO_BYTES * 4) / 3) {
      return json({ error: "Audio too long", transcript: "", items: [] }, 400);
    }

    const userContent: Record<string, unknown>[] = [
      {
        type: "text",
        text: audioB64
          ? `Transcribe the audio and build the food list. User language: ${lang}.`
          : `User language: ${lang}. The person typed: "${text}"`,
      },
    ];
    if (audioB64) {
      userContent.push({ type: "input_audio", input_audio: { data: audioB64, format } });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("transcribe-food AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) return json({ error: "Rate limit exceeded" }, 429);
      if (aiResponse.status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: `AI error: ${aiResponse.status}` }, 502);
    }

    const data = await aiResponse.json();
    const raw = data.choices?.[0]?.message?.content || "";

    let parsed: any = {};
    try {
      const normalized = typeof raw === "string" ? raw : JSON.stringify(raw);
      const stripped = normalized.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const match = stripped.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : stripped);
    } catch (e) {
      console.error("transcribe-food parse error:", raw, e);
      return json({ error: "Could not understand", transcript: "", items: [] }, 200);
    }

    const items = Array.isArray(parsed.items)
      ? parsed.items
          .filter((i: Record<string, unknown>) => i && typeof i === "object")
          .slice(0, 20)
          .map((i: Record<string, unknown>) => {
            const portion_g = Math.max(0, Math.min(3000, Math.round(Number(i.portion_g) || 0)));
            const protein_g = Math.max(0, Math.min(200, Math.round(Number(i.protein_g) || 0)));
            const carbs_g = Math.max(0, Math.min(500, Math.round(Number(i.carbs_g) || 0)));
            const fat_g = Math.max(0, Math.min(200, Math.round(Number(i.fat_g) || 0)));
            let calories = Math.max(0, Math.round(Number(i.calories) || 0));
            const macroCalc = protein_g * 4 + carbs_g * 4 + fat_g * 9;
            if (macroCalc > 0 && (calories > macroCalc * 1.5 || calories < macroCalc * 0.5)) {
              calories = macroCalc;
            }
            calories = Math.min(1500, calories);
            return {
              name: String(i.name || (lang === "en" ? "Food" : "Еда")).slice(0, 80),
              portion_g,
              calories,
              protein_g,
              carbs_g,
              fat_g,
            };
          })
      : [];

    const transcript = typeof parsed.transcript === "string" ? parsed.transcript.slice(0, 1000) : text;

    return json({ transcript, items });
  } catch (e) {
    console.error("transcribe-food error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error", transcript: "", items: [] }, 500);
  }
});
