import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_ANALYSES_PER_DAY = 3;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const SYSTEM_PROMPT = `You are an expert sports nutritionist AI. Analyze the food photos provided and evaluate each meal against established nutrition science and the following trainer guidelines.

## Trainer's Nutrition Plan (baseline reference, not exhaustive):
**Breakfast** — balanced meal: proteins + fats + carbs
- Ideal: eggs, avocado, greens/salad (fiber), optional blueberries, buckwheat
- Coffee without milk preferred

**Lunch** — protein-focused
- Must include: meat or fish + green salad with plenty of greens
- A salad without a protein source is NOT acceptable

**Dinner** — light, low-carb
- Goal: no carbs in the evening to prevent fat gain
- Good options: protein shake (whey + water, no milk), cottage cheese casserole (no sugar)
- Any light protein-rich meal with minimal carbs is acceptable

## Important principles:
- These guidelines are a GENERAL framework. The client may eat different specific foods — judge by NUTRITIONAL QUALITY, not exact menu match.
- Use world-class sports nutrition knowledge to evaluate: macronutrient balance, portion sizes, food quality, timing appropriateness.
- Identify: processed foods, excess sugar, excess carbs at dinner, lack of protein, lack of vegetables/greens, junk food, alcohol-paired meals.
- Be strict but fair. A healthy meal that doesn't exactly match the template but follows good nutrition principles should still score well.

## CRITICAL — Late-night eating penalty:
- Pay close attention to the meal_time field of each photo (this is the actual time the client ate, NOT the upload time).
- If meal_time is provided, use it. If meal_time is "unknown", fall back to created_at as approximate eating time.
- ANY meal (including snacks) eaten after 21:00 should receive a SIGNIFICANT score penalty (-10 to -25 points depending on what was eaten).
- Heavy meals (high carb, high calorie) after 21:00 are especially bad — penalize harshly.
- A light protein snack (e.g. cottage cheese, protein shake) after 21:00 is less bad but still not ideal (-5 to -10).
- In the "issues" array, explicitly flag late-night eating with the approximate time.
- If a meal is labeled "snack" but was eaten late at night and contains significant calories/carbs, treat it as a problematic late dinner in your assessment.

## Manual entries:
- The client may also log meals as TEXT entries (manual entries) without photos.
- These are REAL meals the client actually ate. You MUST include them in your analysis.
- Evaluate manual entries with the SAME strictness as photo-based meals.
- Junk food (pizza, burgers, ice cream, fries, pastries, sugary drinks) must be penalized heavily regardless of whether it comes from a photo or a manual entry.
- Include each manual entry as a separate item in the "meals" array of your response with meal_type based on the entry's label.

## Scoring (0-100):
- Evaluate ALL meals (both from photos AND manual entries)
- For each meal, assess: protein adequacy, vegetable/fiber content, carb appropriateness for time of day, food quality, portion size
- The overall daily score MUST account for ALL meal categories using these weights:
  Breakfast: 30%, Lunch: 35%, Dinner: 25%, Snacks/drinks: 10%
- CRITICAL: If a meal category (breakfast, lunch, or dinner) has NO data at all (no photo AND no manual entry), you MUST score that category as 0 and STILL include it in the weighted average. A client who only ate breakfast and skipped lunch and dinner should score around 25-30, NOT 85+.
- Missing meals are a MAJOR nutritional failure — a full day with only one meal is unhealthy and must be reflected in a LOW overall score.
- Do NOT ignore missing meal categories. Do NOT calculate the average only from meals that exist.

## CRITICAL — Meal grouping:
- You MUST return EXACTLY ONE entry per meal_type in the "meals" array: at most one "breakfast", one "lunch", one "dinner", one "snack".
- If there are multiple photos AND/OR manual entries for the same meal_type (e.g. two dinner photos + two manual dinner entries), MERGE them into a SINGLE meal object. Combine all detected_foods into one array, sum up calories/macros, and give ONE combined score.
- NEVER return multiple objects with the same meal_type. This is the most important formatting rule.

## Response format (JSON only, no markdown):
{
  "overall_score": 0-100,
  "total_calories": 0,
  "total_protein_g": 0,
  "total_carbs_g": 0,
  "total_fat_g": 0,
  "meals": [
    {
      "meal_type": "breakfast|lunch|dinner|snack",
      "detected_foods": [
        {"name": "food1", "portion_g": 150, "calories": 200, "protein_g": 15, "carbs_g": 20, "fat_g": 8}
      ],
      "estimated_calories": 400,
      "protein_g": 30,
      "carbs_g": 40,
      "fat_g": 15,
      "protein_adequate": true,
      "vegetables_present": true,
      "score": 0-100,
      "issues": ["issue1"],
      "positives": ["positive1"]
    }
  ],
  "summary_ru": "Краткий итог на русском языке (2-3 предложения). Что хорошо, что нужно улучшить.",
  "summary_en": "Brief summary in English (2-3 sentences). What's good, what needs improvement."
}

IMPORTANT: For detected_foods, return an array of objects with name, portion_g, calories, protein_g, carbs_g, fat_g for each detected food item — these are used ONLY for qualitative feedback (positives, issues, scoring), NOT for daily totals. The server will recompute total_calories, total_protein_g, total_carbs_g, total_fat_g and per-meal calorie/macro totals strictly from the client's manual_entries (the source of truth). You may still return totals fields, but they will be overridden. Do NOT add extra "phantom" foods to detected_foods that the client did not log via manual_entries — only describe what the client actually entered.`;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "No authorization header" }, 401);
    }

    const { user_id, log_date } = await req.json();

    // --- Input validation ---
    if (!user_id || !log_date) {
      return jsonResponse({ error: "user_id and log_date required" }, 400);
    }
    if (!UUID_REGEX.test(user_id)) {
      return jsonResponse({ error: "Invalid user_id format" }, 400);
    }
    if (!DATE_REGEX.test(log_date)) {
      return jsonResponse({ error: "Invalid date format" }, 400);
    }
    const parsedDate = new Date(log_date + "T00:00:00Z");
    if (isNaN(parsedDate.getTime())) {
      return jsonResponse({ error: "Invalid date" }, 400);
    }
    const now = new Date();
    now.setUTCHours(23, 59, 59, 999);
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 1);
    if (parsedDate > now || parsedDate < minDate) {
      return jsonResponse({ error: "Date out of allowed range" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // --- Auth: verify user ---
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    // Check: user is either the owner or a trainer
    const isTrainer = user.id !== user_id
      ? (await supabase.rpc("has_role", { _user_id: user.id, _role: "trainer" })).data === true
      : false;

    if (user.id !== user_id && !isTrainer) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    // --- Rate limit (server-side) ---
    const { data: currentLog } = await supabase
      .from("nutrition_logs")
      .select("ai_analysis")
      .eq("user_id", user_id)
      .eq("log_date", log_date)
      .maybeSingle();

    const currentCount = (currentLog?.ai_analysis as Record<string, unknown>)?.analysis_count as number || 0;
    if (currentCount >= MAX_ANALYSES_PER_DAY) {
      return jsonResponse({ error: "Analysis limit reached (max 3 per day)" }, 429);
    }

    // --- Fetch food photos and manual entries ---
    const [{ data: photos, error: photosError }, { data: logData }] = await Promise.all([
      supabase
        .from("food_photos")
        .select("*")
        .eq("user_id", user_id)
        .eq("log_date", log_date)
        .order("created_at", { ascending: true }),
      supabase
        .from("nutrition_logs")
        .select("manual_entries")
        .eq("user_id", user_id)
        .eq("log_date", log_date)
        .maybeSingle(),
    ]);

    if (photosError) throw photosError;

    const manualEntries = ((logData?.manual_entries || []) as Array<Record<string, unknown>>);
    const hasPhotos = photos && photos.length > 0;
    const hasManual = manualEntries.length > 0;

    if (!hasPhotos && !hasManual) {
      const emptyAnalysis = { overall_score: 0, meals: [], analysis_count: currentCount + 1 };
      const { error: upsertError } = await supabase
        .from("nutrition_logs")
        .upsert(
          { user_id, log_date, ai_score: 0, ai_feedback: "Нет данных о питании за этот день / No food data for this day", ai_analysis: emptyAnalysis },
          { onConflict: "user_id,log_date" }
        );
      if (upsertError) throw upsertError;

      return jsonResponse({ score: 0, feedback: "No food data for this day", analysis: emptyAnalysis });
    }

    // --- Build AI request ---
    let manualEntriesText = "";
    if (hasManual) {
      manualEntriesText = `\n\nMANUAL ENTRIES (typed by the client, no photos — you MUST include these in your analysis and overall scoring):\n${manualEntries.map((e, i) => {
        const mealType = (e.meal_type as string) || "unknown";
        const mealTime = (e.meal_time as string) || "unknown";
        return `Entry ${i + 1}: "${e.name}" — meal_type="${mealType}", meal_time="${mealTime}", calories=${e.calories || 0}, protein=${e.protein_g || 0}g, carbs=${e.carbs_g || 0}g, fat=${e.fat_g || 0}g`;
      }).join('\n')}\n\nCRITICAL: Manual entries are REAL meals the client ate. They MUST affect the overall score. Junk food (pizza, burgers, ice cream, fries, etc.) in manual entries should be penalized just as harshly as if you saw it in a photo. Include each manual entry as a separate meal item in your response.`;
    }

    const photoCount = photos?.length || 0;
    const userContent: unknown[] = [
      {
        type: "text",
        text: `Analyze food intake from ${log_date}. There are ${photoCount} food photo(s)${hasManual ? ` and ${manualEntries.length} manual text entries` : ''}. Each photo has a meal type label assigned by the client — you MUST respect the client's meal_type assignment, do NOT reassign photos to different meal types. Return ONLY valid JSON, no markdown.\n\n${photoCount > 0 ? `Photos:\n${photos!.map((p: Record<string, unknown>, i: number) => `Photo ${i + 1}: meal_type="${p.meal_type}", meal_time="${(p as any).meal_time || 'unknown'}" (uploaded at ${(p as any).created_at})`).join('\n')}` : 'No photos uploaded.'}${manualEntriesText}`,
      },
    ];

    if (photos) {
      for (const photo of photos) {
        userContent.push({
          type: "image_url",
          image_url: { url: (photo as Record<string, unknown>).photo_url },
        });
      }
    }

    // --- Call AI ---
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return jsonResponse({ error: "Rate limit exceeded. Please try again in a minute." }, 429);
      }
      if (aiResponse.status === 402) {
        return jsonResponse({ error: "AI credits exhausted. Please top up." }, 402);
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // --- Parse AI response ---
    let analysis: Record<string, unknown>;
    try {
      const jsonStr = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      analysis = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      analysis = { overall_score: 50, meals: [], summary_ru: "Не удалось обработать ответ AI. Попробуйте ещё раз.", summary_en: "Failed to process AI response. Please try again." };
    }

    const score = Math.min(100, Math.max(0, Math.round((analysis.overall_score as number) || 0)));
    const feedback = (analysis.summary_ru || analysis.summary_en || "") as string;

    // --- AUTHORITATIVE TOTALS: recompute strictly from manual_entries ---
    // detected_foods from AI are used only for qualitative feedback (positives/issues/scores),
    // never for calorie/macro totals. This prevents AI from inflating totals with "phantom" items
    // it sees on photos but the client did not log.
    const num = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : 0;
    };
    let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0;
    const perMealTotals: Record<string, { calories: number; protein_g: number; carbs_g: number; fat_g: number }> = {};
    for (const e of manualEntries) {
      const mt = String((e.meal_type as string) || "snack").toLowerCase();
      const c = num(e.calories), p = num(e.protein_g), cb = num(e.carbs_g), f = num(e.fat_g);
      totalCalories += c; totalProtein += p; totalCarbs += cb; totalFat += f;
      if (!perMealTotals[mt]) perMealTotals[mt] = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
      perMealTotals[mt].calories += c;
      perMealTotals[mt].protein_g += p;
      perMealTotals[mt].carbs_g += cb;
      perMealTotals[mt].fat_g += f;
    }
    analysis.total_calories = Math.round(totalCalories);
    analysis.total_protein_g = Math.round(totalProtein);
    analysis.total_carbs_g = Math.round(totalCarbs);
    analysis.total_fat_g = Math.round(totalFat);

    // Override per-meal calorie/macro totals with manual-entry sums.
    // Keep AI's qualitative fields (score, issues, positives, detected_foods, flags).
    if (Array.isArray(analysis.meals)) {
      analysis.meals = (analysis.meals as Array<Record<string, unknown>>).map((m) => {
        const mt = String((m.meal_type as string) || "").toLowerCase();
        const t = perMealTotals[mt];
        if (t) {
          return {
            ...m,
            estimated_calories: t.calories,
            protein_g: t.protein_g,
            carbs_g: t.carbs_g,
            fat_g: t.fat_g,
          };
        }
        // No manual entry for this meal_type — zero out totals (detected_foods stays for context)
        return { ...m, estimated_calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
      });
    }

    // Increment analysis count and track which manual entries were included
    analysis.analysis_count = currentCount + 1;
    analysis.included_manual_ids = manualEntries.map((e) => e.id).filter(Boolean);
    analysis.totals_source = "manual_entries";

    // --- Save to DB ---
    const { error: upsertError } = await supabase
      .from("nutrition_logs")
      .upsert(
        { user_id, log_date, ai_score: score, ai_feedback: feedback, ai_analysis: analysis },
        { onConflict: "user_id,log_date" }
      );
    if (upsertError) throw upsertError;

    // --- Notify trainer via Telegram ---
    try {
      const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
      const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        // Fetch client name and manual entries
        const [{ data: profile }, { data: logData }] = await Promise.all([
          supabase.from("profiles").select("full_name").eq("user_id", user_id).single(),
          supabase.from("nutrition_logs").select("manual_entries").eq("user_id", user_id).eq("log_date", log_date).single(),
        ]);

        const clientName = profile?.full_name || "Клиент";
        const summaryRu = (analysis.summary_ru || analysis.summary_en || feedback || "") as string;
        const appUrl = "https://my-fitness-coach-app.lovable.app";

        const scoreEmoji = score >= 75 ? "🟢" : score >= 50 ? "🟡" : "🔴";

        // Build meals detail — now one entry per meal_type
        const meals = (analysis.meals as Array<Record<string, unknown>>) || [];
        const mealsDetail = meals.map((m) => {
          const mealScore = (m.score as number) || 0;
          const mealEmoji = mealScore >= 75 ? "✅" : mealScore >= 50 ? "⚠️" : "❌";
          const detectedFoods = (m.detected_foods as Array<Record<string, unknown>>) || [];
          const foods = detectedFoods.map((f) => {
            if (typeof f === "string") return f;
            return `${f.name}${f.portion_g ? ` (${f.portion_g}g)` : ""} — ${f.calories || 0}kcal`;
          }).join(", ");
          return `${mealEmoji} <b>${m.meal_type}</b> — ${mealScore}/100${foods ? `\n   ${foods}` : ""}`;
        }).join("\n");

        // Include manual entries
        const manualEntries = ((logData?.manual_entries || []) as Array<Record<string, unknown>>);
        let manualDetail = "";
        if (manualEntries.length > 0) {
          const manualLines = manualEntries.map((e) => 
            `✏️ ${e.name || "Quick add"} — ${e.calories || 0}kcal (P${e.protein_g || 0} C${e.carbs_g || 0} F${e.fat_g || 0})`
          ).join("\n");
          manualDetail = `\n\n📝 <b>Ручной ввод:</b>\n${manualLines}`;
        }

        const msg = `🍽 <b>Дневник питания</b>\n\n👤 ${clientName}\n📅 ${log_date}\n${scoreEmoji} Оценка: <b>${score}/100</b>\n\n${mealsDetail ? mealsDetail + "\n" : ""}${manualDetail}\n\n💬 ${summaryRu}\n\n🔗 <a href="${appUrl}">Открыть приложение</a>`;

        const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML", disable_web_page_preview: true }),
        });
        if (!res.ok) {
          console.error("Telegram notify error:", await res.text());
        }
      }
    } catch (tgErr) {
      console.error("Telegram notification failed (non-critical):", tgErr);
    }

    return jsonResponse({ score, feedback, analysis });
  } catch (e) {
    console.error("analyze-nutrition error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
