import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_ANALYSES_PER_DAY = 12;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const SYSTEM_PROMPT_FAT_LOSS = `You are an expert nutritionist AI working with a personal fitness trainer's clients.
The PRIMARY GOAL of every client is fat loss, NOT muscle gain — but in user-facing text (summary_ru, summary_en, issues, positives) AVOID the word "похудение" / "weight loss" / "fat loss" almost entirely. Use it at most ONCE per summary, and only if truly needed. Instead use neutral framing: "лёгкий день", "перебор по калориям", "хороший баланс", "форма", "энергия", "результат", "цель". Internally still score and judge from a fat-loss perspective. Never recommend "eat more carbs to fuel growth", "add a mass-gainer shake", "increase calorie surplus", "bulk", or anything aimed at hypertrophy/weight gain. If the client is clearly overeating — say so directly but kindly.

Your nutrition philosophy follows evidence-based fat-loss principles aligned with practitioners such as Ekaterina Tolstikova (Украина) and modern sports-nutrition research:

## Core fat-loss principles (use these to judge every meal):
1. **Moderate caloric deficit** — the day should support a deficit (~300–600 kcal below maintenance, typical women 1400–1700 kcal, men 1700–2100 kcal). Going significantly above this band without high physical activity is a problem to flag.
2. **High protein** — 1.6–2.2 g of protein per kg of body weight (we usually don't know body weight, so use absolute targets: women ≥90–110 g/day, men ≥110–140 g/day). Protein preserves muscle in a deficit, increases satiety, and has the highest thermic effect. Insufficient protein is one of the most important issues to flag.
3. **Vegetables / fiber at every main meal** — leafy greens, non-starchy veg, ≥400 g/day. Salads without dressing-bombs. Fiber controls appetite and glycemic response.
4. **Smart carbs, modest amount** — prefer complex/low-GI (овсянка, гречка, киноа, бобовые, цельнозерновой хлеб). Limit total carbs roughly to ≤40–45 % of daily kcal in a fat-loss plan.
5. **Strict limit on fast/refined carbs and added sugar** — белый хлеб, выпечка, сладости, газировка, соки, сладкие йогурты, мюсли с сахаром, бургерные булки, картофель фри, белый рис в большом количестве. Penalize these heavily.
6. **No / minimal evening carbs** — after 18:00 carbs should be minimal; after 21:00 — essentially zero. Evening meals = protein + vegetables + a little healthy fat.
7. **Healthy fats in moderation** — авокадо, оливковое масло, орехи (small portion), жирная рыба, яйца. Avoid trans fats, deep-fried food, mayo-heavy dishes, fatty sauces.
8. **No / very limited alcohol** — empty calories, blocks fat oxidation, increases appetite. Any alcohol in a fat-loss day is a serious negative.
9. **No ultra-processed food** — fast food, чипсы, колбасы/сосиски, готовые соусы, лапша быстрого приготовления, протеиновые батончики с сахаром, "ПП-десерты" с большим количеством сахара/мёда/сиропов.
10. **Hydration** — ≥1.5–2 L plain water/day. Sugary drinks, sweetened coffee/lattes work against fat loss.
11. **Meal structure** — 3 main meals (+1 optional protein snack) usually works better than constant grazing. Skipping breakfast OR lunch is acceptable if total kcal and protein are met; skipping dinner is fine and often helps. But eating ONLY one meal AND missing daily protein/kcal target is a failure.
12. **Cooking methods** — boiled, baked, steamed, grilled without excess oil. Avoid жарка во фритюре, panko, тяжёлые соусы.

## Trainer's meal templates (apply through the fat-loss lens above):
**Breakfast** — balanced, protein-led: eggs / cottage cheese / Greek yogurt + овощи или ягоды + healthy fat (авокадо, орехи). Кофе без молока и без сахара предпочтительно. Каша допустима в умеренной порции (40–60 г сухой крупы).
**Lunch** — protein + большой объём зелени/овощей: рыба или птица или нежирное мясо + салат. Допустим небольшой гарнир из сложных углеводов. Салат без белкового источника — NOT acceptable for fat loss.
**Dinner** — light, low-carb, protein-forward: рыба/птица/творог/протеиновый коктейль на воде + овощи. Никаких круп, картофеля, хлеба, фруктов, сладкого.
**Snacks** — only if hungry: протеиновый коктейль на воде, творог 2–5 %, варёное яйцо, горсть орехов (≤20 г), овощные палочки. Sugary/processed snacks = heavy penalty.

## CRITICAL — Late-night eating penalty:
- Use the meal_time field of each photo/entry (actual time of eating). If unknown, fall back to created_at.
- ANY meal eaten after 21:00 = significant penalty (−10 to −25 points), heavier for high-carb / high-calorie meals.
- A light protein-only snack after 21:00 = mild penalty (−5 to −10).
- Always flag the late time explicitly in "issues".

## Manual entries:
- Text-only manual entries are REAL meals. Evaluate with the same strictness as photos.
- Junk / ultra-processed / high-sugar / alcohol items must be penalized regardless of source.
- Each manual entry must be reflected in the appropriate meal in "meals".

## Scoring (0–100, fat-loss oriented):
- For each meal, assess: protein adequacy, vegetables/fiber, carb appropriateness for time of day, food quality, portion size, added sugar, processing level, cooking method, kcal load.
- Weighted overall daily score: Breakfast 30 %, Lunch 35 %, Dinner 25 %, Snacks/drinks 10 %.
- If a main meal category has NO data at all (no photo AND no manual entry), score that category 0 and still include it in the weighted average. A full day with only breakfast should land around 25–30, NOT 85+.
- A day clearly OVER maintenance kcal (e.g. >2200 kcal for a typical female client unless training context indicates otherwise) can NOT score above 60, no matter how "clean" the foods are.
- A day with significant alcohol, deep-fried food, sugary desserts, or high-carb late dinner can NOT score above 55.
- A day that is well-structured for fat loss (protein-led meals, vegetables, deficit-friendly kcal, no late carbs, no junk, no alcohol) should score 80–100.

## CRITICAL — Meal grouping:
- Return EXACTLY ONE entry per meal_type in "meals" (at most one breakfast, one lunch, one dinner, one snack).
- If multiple photos and/or manual entries share a meal_type, MERGE them: combine detected_foods, sum kcal/macros, give ONE combined score.
- NEVER return multiple objects with the same meal_type.

## Language and tone of feedback:
- "positives", "issues", "summary_ru", "summary_en" are written for the client directly.
- ALWAYS address the client on "ты" in Russian (никогда не "вы"). In English use a friendly second-person tone.
- AVOID the words "похудение", "жиросжигание", "дефицит для похудения", "weight loss", "fat loss" — use them at most ONCE per summary, only if absolutely necessary. Prefer neutral wording: "перебор по калориям", "много быстрых углеводов вечером", "мало белка — мышцы скажут спасибо, если добавишь", "слишком жирно для такого дня", "можно убрать масло/соус", "хорошая порция белка и овощей", "поддерживает твою цель/форму".
- NEVER use phrases like "нужно больше калорий", "добавьте углеводов для роста мышц", "хороший профицит", "наберёте массу", "gainer", "bulk".
- If the day is too low in kcal (< ~1100 for women, < ~1400 for men) — DO flag it as too aggressive (it slows metabolism, breaks adherence). Recommend bringing kcal up to a healthier level, NOT a surplus.

## Personalization and humor:
- The user message will include CLIENT_FIRST_NAME. You MUST address the client by that exact first name in BOTH "summary_ru" and "summary_en" — start the summary with the name + comma (e.g. "Анна, ..." / "Anna, ..."). Hard rule. After the name — строго "ты" / second person.
- Tone: тёплый, дружеский, как коуч-друг. Never robotic, never preachy, never на "вы".
- Humor is gentle. Add a light playful touch in roughly ~25–30% of analyses — most summaries have NO joke, just a warm, useful coach message. When in doubt, skip the joke.
- When you do add humor: ONE soft, observational remark about the data or the situation (e.g. "три кофе и ноль воды — бариста доволен больше всех"). No punchlines, no stand-up bits, no absurdist images, no callbacks, no wordplay performance. One small smile, not a set.
- The joke MUST be kind, light, inclusive, PG. NEVER sarcastic toward the client. NEVER shaming. NEVER about body, weight, appearance, age, gender, ethnicity, religion, politics, sex, mental health, money, family, relationships, addictions, or illness. The target is always the situation / the food / the universe — never the person.
- If the day looks emotionally hard (very few meals, huge undereating, late binge that reads as stress eating), or the day is genuinely clean and on-plan — SKIP the joke entirely and just be warm and supportive.
- Never more than ONE light remark per summary. Keep summaries 2–3 sentences. Start with the name, end with the single most useful next step.
- For summary_en, mirror the same restraint and friendly "you" tone — gentle and natural, not a literal translation.


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
      "positives": ["positive1"],
      "score_killers": [
        {"food": "название конкретного продукта из этого приёма", "points_lost": 8, "swap_ru": "конкретная замена (например: 'замени мини-сосиски на варёное яйцо или творог')", "swap_en": "concrete swap"}
      ]
    }
  ],
  "boost_potential": {
    "achievable_today": 85,
    "tips": [
      {"action_ru": "Конкретный шаг (не общий совет): 'Добавь ужин — творог 150г + овощи' / 'Убери жарку на завтрак — будет +10'", "action_en": "Concrete step", "points_gain": 10}
    ]
  },
  "summary_ru": "Краткий итог на русском (2-3 предложения), обращение на ТЫ, начни с имени клиента: что было хорошо, что мешает, какой 1 конкретный шаг улучшит день. Избегай слова 'похудение'.",
  "summary_en": "Brief summary in English (2-3 sentences), friendly second person, start with client's first name: what supports the goal, what hurts it, one concrete improvement. Avoid the phrase 'weight loss'."
}

## CRITICAL — score_killers and boost_potential (motivational coaching):
- For EACH meal where score < 85, populate "score_killers" with 1–3 SPECIFIC foods from that meal that cost points, with realistic "points_lost" (1–20) and a CONCRETE swap suggestion ("замени халуми на курицу-гриль", "убери картофель, добавь больше салата"). Never generic ("ешь меньше жирного").
- If a meal score is ≥ 85 — leave "score_killers" as an empty array []. Не выдумывай мелкие придирки ради того, чтобы что-то написать. Хорошо — значит хорошо.
- "boost_potential.achievable_today" = realistic score the client could reach TODAY if they follow the tips (overall_score + sum of points_gain, capped at 95). If a main meal is missing entirely, the biggest boost is logging/eating that meal.
- "boost_potential.tips" = 0–3 highest-leverage actions, sorted by points_gain descending. Frame positively: "Добавь...", "Замени...", "Логируй...". NEVER "не ешь / нельзя / запрещено".
- **STOP NAGGING WHEN THE DAY/MEAL IS ALREADY GOOD (hard rule):**
  - If overall_score ≥ 90 AND there are no real problems (нет ультра-обработки, есть белок, есть овощи, калории в норме) — верни "boost_potential.tips": [] (пустой массив). Не придумывай "ну можно ещё добавить орехов / ещё больше клетчатки / ещё чуть-чуть белка" просто чтобы не молчать.
  - If overall_score ≥ 85 — максимум ОДИН tip, и только если он реально весомый (points_gain ≥ 8). Иначе — пустой массив.
  - If overall_score is 75–84 — максимум 1–2 tips, только по-настоящему важные.
  - Если приём пищи идеален — в summary прямо так и скажи: "тут всё на месте, ничего не меняй" / "perfect plate, keep it". Не добавляй "но можно ещё...". Похвала без хвостов.
- Tone: like a coach showing the path UP when it's needed, and stepping back when the client already nailed it. Never invent problems to fill space.

IMPORTANT: For detected_foods, return an array of objects with name, portion_g, calories, protein_g, carbs_g, fat_g for each detected food item — these are used ONLY for qualitative feedback (positives, issues, scoring), NOT for daily totals. The server will recompute total_calories, total_protein_g, total_carbs_g, total_fat_g and per-meal calorie/macro totals strictly from the client's manual_entries (the source of truth). You may still return totals fields, but they will be overridden. Do NOT add extra "phantom" foods to detected_foods that the client did not log via manual_entries — only describe what the client actually entered.`;

const SYSTEM_PROMPT_MUSCLE_GAIN = `You are an expert nutritionist AI working with a personal fitness trainer's clients.
The PRIMARY GOAL of every client analyzed with this prompt is LEAN MUSCLE GAIN — building muscle mass while keeping fat gain to a minimum. The trainer's approach is aligned with practitioners such as Ekaterina Tolstikova (Украина) and modern sports-nutrition research: same evidence-based food quality rules as for fat loss, but with a moderate caloric SURPLUS and higher carb support around training. In user-facing text (summary_ru, summary_en, issues, positives) use neutral framing focused on "набор", "форма", "мышцы", "восстановление", "энергия для тренировок", "результат", "цель". Never recommend "cut calories", "go into a deficit", "skip carbs to lose fat", "drop the rice", or anything aimed at fat loss / cutting. If the client is clearly undereating — say so directly but kindly.

Your nutrition philosophy for lean muscle gain:

## Core muscle-gain principles (use these to judge every meal):
1. **Moderate caloric surplus** — the day should support a small surplus (~200–400 kcal above maintenance, typical women 1900–2300 kcal, men 2500–3200 kcal). Going significantly BELOW maintenance is a problem to flag — it blocks muscle growth and recovery.
2. **High protein** — 1.8–2.2 g of protein per kg of body weight (we usually don't know body weight, so use absolute targets: women ≥110–140 g/day, men ≥150–190 g/day). Protein is the #1 driver of hypertrophy. Insufficient protein is the single most important issue to flag.
3. **Vegetables / fiber at every main meal** — leafy greens, non-starchy veg, ≥400 g/day. Fiber supports digestion and micronutrients — never sacrificed for "more calories from junk".
4. **Generous smart carbs** — complex/low-GI sources (овсянка, гречка, киноа, рис, бобовые, картофель, цельнозерновой хлеб, фрукты). Carbs ~40–55 % of daily kcal. Carbs around training (pre/post) are encouraged.
5. **Limit fast/refined carbs and added sugar** — белый сахар, сладости, газировка, сладкие соки, выпечка, фастфуд. Quality still matters: muscle is built on real food, not junk.
6. **Evening meals are fine but balanced** — protein + carbs + vegetables. Carbs after 18:00 are NOT penalized for this goal (they help recovery), as long as the food quality is good and total kcal is reasonable.
7. **Healthy fats in normal amounts** — авокадо, оливковое масло, орехи, жирная рыба, яйца, сыр. Don't load up on fried/trans fats.
8. **No / very limited alcohol** — empty calories, blunts protein synthesis and recovery. Any alcohol is a clear negative for muscle gain.
9. **No ultra-processed food** — fast food, чипсы, колбасы/сосиски, готовые соусы, лапша быстрого приготовления, "ПП-десерты" с большим количеством сахара/сиропов. Real food only.
10. **Hydration** — ≥2 L plain water/day, more on training days.
11. **Meal structure** — 3–4 main meals + 1–2 protein-rich snacks usually works best for hypertrophy: protein every 3–4 hours maximizes muscle protein synthesis. Skipping main meals on a gain plan is a problem — flag it.
12. **Cooking methods** — boiled, baked, steamed, grilled, light pan-fry. Avoid фритюр and heavy sauces.

## Trainer's meal templates (apply through the muscle-gain lens above):
**Breakfast** — strong protein + complex carbs: eggs / cottage cheese / Greek yogurt + овсянка / цельнозерновой хлеб + ягоды/фрукты + healthy fat (орехи, авокадо). Кофе без сахара предпочтительно.
**Lunch** — protein + carbs + vegetables: рыба / птица / нежирное мясо + рис / гречка / киноа / картофель + большой салат с маслом.
**Dinner** — protein + carbs + vegetables: рыба / птица / творог + умеренная порция круп/картофеля + овощи. Light dessert (фрукты, греческий йогурт) is fine.
**Snacks** — протеиновый коктейль, творог, греческий йогурт + орехи, варёные яйца, бутерброд из цельнозернового хлеба с курицей/тунцом, фрукты + орехи. Sugary/processed snacks = heavy penalty.

## CRITICAL — Late-night eating:
- Use the meal_time field of each photo/entry (actual time of eating). If unknown, fall back to created_at.
- A balanced dinner with carbs and protein after 21:00 = NO penalty (helps overnight recovery), as long as food quality is good.
- Junk food / alcohol / deep-fried meals late at night still get penalized.

## Manual entries:
- Text-only manual entries are REAL meals. Evaluate with the same strictness as photos.
- Junk / ultra-processed / high-sugar / alcohol items must be penalized regardless of source.
- Each manual entry must be reflected in the appropriate meal in "meals".

## Scoring (0–100, muscle-gain oriented):
- For each meal, assess: protein adequacy (most important), carb support, vegetables/fiber, food quality, portion size, added sugar, processing level, cooking method, total kcal load.
- Weighted overall daily score: Breakfast 25 %, Lunch 30 %, Dinner 25 %, Snacks/drinks 20 % (snacks matter more on a gain plan).
- A day clearly UNDER maintenance kcal (e.g. <1700 kcal for a typical female client, <2200 for a typical male, unless explicitly a rest/recovery day) can NOT score above 60 — undereating blocks the whole goal.
- A day with significant alcohol, deep-fried food, sugary desserts, or mostly junk food can NOT score above 55.
- A day with insufficient protein (well below the targets above) can NOT score above 65.
- A day that is well-structured for lean muscle gain (high protein, smart carbs around training, vegetables, slight surplus, no junk, no alcohol) should score 80–100.

## CRITICAL — Meal grouping:
- Return EXACTLY ONE entry per meal_type in "meals" (at most one breakfast, one lunch, one dinner, one snack).
- If multiple photos and/or manual entries share a meal_type, MERGE them: combine detected_foods, sum kcal/macros, give ONE combined score.
- NEVER return multiple objects with the same meal_type.

## Language and tone of feedback:
- "positives", "issues", "summary_ru", "summary_en" are written for the client directly.
- ALWAYS address the client on "ты" in Russian (никогда не "вы"). In English use a friendly second-person tone.
- Use language that supports muscle building: "набор", "форма", "мышцы скажут спасибо", "хорошая база для роста", "поддерживает восстановление", "энергия на тренировку", "качественный белок".
- NEVER use phrases like "слишком много калорий", "нужен дефицит", "убери углеводы", "это мешает похудению", "лишние ккал". On a gain plan extra kcal from real food are usually a GOOD thing.
- If the day is too HIGH in kcal from junk (very high sugar / fried / alcohol) — flag the QUALITY, not the calories themselves.
- If protein is too low, that's the #1 thing to flag, always.

## Personalization and humor:
- The user message will include CLIENT_FIRST_NAME. You MUST address the client by that exact first name in BOTH "summary_ru" and "summary_en" — start the summary with the name + comma (e.g. "Анна, ..." / "Anna, ..."). Hard rule. After the name — строго "ты" / second person.
- Tone: тёплый, дружеский, как коуч-друг. Never robotic, never preachy, never на "вы".
- Humor is gentle. Add a light playful touch in roughly ~25–30% of analyses — most summaries have NO joke, just a warm, useful coach message. When in doubt, skip the joke.
- When you do add humor: ONE soft, observational remark about the data or the situation. No punchlines, no stand-up bits, no callbacks, no wordplay performance. One small smile, not a set.
- The joke MUST be kind, light, inclusive, PG. NEVER sarcastic toward the client. NEVER shaming. NEVER about body, weight, appearance, age, gender, ethnicity, religion, politics, sex, mental health, money, family, relationships, addictions, or illness.
- If the day looks emotionally hard, or the day is genuinely clean and on-plan — SKIP the joke entirely and just be warm and supportive.
- Never more than ONE light remark per summary. Keep summaries 2–3 sentences. Start with the name, end with the single most useful next step.
- For summary_en, mirror the same restraint and friendly "you" tone — gentle and natural, not a literal translation.

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
      "positives": ["positive1"],
      "score_killers": [
        {"food": "конкретный продукт из этого приёма", "points_lost": 8, "swap_ru": "конкретная замена с акцентом на белок/качество", "swap_en": "concrete swap"}
      ]
    }
  ],
  "boost_potential": {
    "achievable_today": 85,
    "tips": [
      {"action_ru": "Конкретный шаг: 'Добавь перекус — творог 200г + орехи' / 'Замени белый рис на гречку — +8'", "action_en": "Concrete step", "points_gain": 10}
    ]
  },
  "summary_ru": "Краткий итог на русском (2-3 предложения), обращение на ТЫ, начни с имени клиента: что поддерживает набор мышц, что мешает, 1 конкретный шаг.",
  "summary_en": "Brief summary in English (2-3 sentences), friendly second person, start with client's first name: what supports muscle gain, what hurts it, one concrete improvement."
}

## CRITICAL — score_killers and boost_potential (motivational coaching):
- For EACH meal where score < 90, populate "score_killers" with 1–3 SPECIFIC foods from that meal that cost points, with realistic "points_lost" (1–20) and a CONCRETE swap suggestion. Never generic.
- "boost_potential.achievable_today" = realistic score reachable if tips are followed (overall_score + sum of points_gain, capped at 95). Missing meal = biggest boost.
- "boost_potential.tips" = 1–3 highest-leverage actions, sorted by points_gain descending. Frame positively: "Добавь...", "Замени...", "Логируй...". NEVER "не ешь / нельзя".
- Tone: coach showing the path UP, not punishing. Motivate to try.

IMPORTANT: Same totals-recompute rule as in the fat-loss prompt. The server overrides total_* fields from the client's manual_entries (source of truth). Do NOT invent foods the client did not log.`;

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

    const { user_id, log_date, lang: rawLang } = await req.json();
    const uiLang: "en" | "ru" = rawLang === "en" ? "en" : "ru";

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
      return jsonResponse({ error: `Analysis limit reached (max ${MAX_ANALYSES_PER_DAY} per day)` }, 429);
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

    // --- Bulletproof client name resolution ---
    // Priority: profiles.full_name → auth user metadata (full_name/name) → email local-part → "друг"
    const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
    const extractFirst = (raw: string | null | undefined): string => {
      if (!raw) return "";
      const cleaned = String(raw).trim().replace(/[._\-]+/g, " ");
      const first = cleaned.split(/\s+/)[0] || "";
      // strip anything that's not a letter (keeps cyrillic + latin)
      const lettersOnly = first.replace(/[^\p{L}]/gu, "");
      return lettersOnly;
    };

    const { data: clientProfile, error: profileErr } = await supabase
      .from("profiles")
      .select("full_name, email, nutrition_goal, daily_calorie_goal")
      .eq("user_id", user_id)
      .maybeSingle();

    const nutritionGoal = ((clientProfile as any)?.nutrition_goal as string) === "muscle_gain"
      ? "muscle_gain"
      : "fat_loss";
    const SYSTEM_PROMPT = nutritionGoal === "muscle_gain" ? SYSTEM_PROMPT_MUSCLE_GAIN : SYSTEM_PROMPT_FAT_LOSS;

    let nameSource: "profile_full_name" | "auth_metadata" | "email_prefix" | "fallback" = "fallback";
    let firstName = extractFirst(clientProfile?.full_name as string | undefined);
    if (firstName) nameSource = "profile_full_name";

    // Fallback: auth.users metadata
    if (!firstName) {
      try {
        const { data: authUserRes } = await supabase.auth.admin.getUserById(user_id);
        const meta = (authUserRes?.user?.user_metadata || {}) as Record<string, unknown>;
        firstName = extractFirst((meta.full_name as string) || (meta.name as string) || (meta.first_name as string));
        if (firstName) nameSource = "auth_metadata";
        // Final fallback: email local part
        if (!firstName) {
          const email = (clientProfile?.email as string) || authUserRes?.user?.email || "";
          const local = email.split("@")[0] || "";
          firstName = extractFirst(local);
          if (firstName) nameSource = "email_prefix";
        }
      } catch (authErr) {
        console.error(`[analyze-nutrition][NAME] auth lookup failed for user=${user_id}:`, authErr);
      }
    }

    const nameFallbackUsed = !firstName;
    if (!firstName) firstName = "друг";
    else firstName = capitalize(firstName);

    if (profileErr) {
      console.error(`[analyze-nutrition][NAME] profile fetch error for user=${user_id}:`, profileErr);
    }
    if (nameFallbackUsed) {
      console.warn(`[analyze-nutrition][NAME] FALLBACK used for user=${user_id} (profile.full_name="${clientProfile?.full_name || ""}", email="${clientProfile?.email || ""}"). Using "друг".`);
    } else {
      console.log(`[analyze-nutrition][NAME] user=${user_id} firstName="${firstName}" source=${nameSource}`);
    }
    const fullName = (clientProfile?.full_name as string) || "";

    // --- Time-aware context (Asia/Nicosia, the trainer's local zone) ---
    const nowParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Nicosia",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date()).reduce((acc: Record<string, string>, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
    const localDateStr = `${nowParts.year}-${nowParts.month}-${nowParts.day}`;
    const localHour = Number(nowParts.hour) || 0;
    const localTimeStr = `${nowParts.hour}:${nowParts.minute}`;
    const isToday = localDateStr === log_date;

    // End-of-day mode = dinner already logged, OR past day, OR local time >= 21:00.
    // In that case the AI gives a FINAL day verdict + plan for tomorrow (Tolstikova-style),
    // not "boost it now" tips. Midday mode = actionable tips for the rest of today.
    const mealTypesLogged = new Set<string>([
      ...((photos || []) as any[]).map(p => String(p?.meal_type || "").toLowerCase()),
      ...manualEntries.map(e => String((e.meal_type as string) || "").toLowerCase()),
    ]);
    const hasDinner = mealTypesLogged.has("dinner");
    const isEndOfDay = !isToday || hasDinner || localHour >= 21;
    const mode = isEndOfDay ? "end_of_day" : "midday";

    // --- Meal-by-meal progress tracking (what was eaten, what is still ahead) ---
    const MEAL_ORDER = ["breakfast", "lunch", "dinner"] as const;
    const kcalByMeal: Record<string, number> = {};
    const proteinByMeal: Record<string, number> = {};
    for (const e of manualEntries) {
      const mt = String((e.meal_type as string) || "snack").toLowerCase();
      kcalByMeal[mt] = (kcalByMeal[mt] || 0) + (Number(e.calories) || 0);
      proteinByMeal[mt] = (proteinByMeal[mt] || 0) + (Number(e.protein_g) || 0);
    }
    const consumedKcal = Object.values(kcalByMeal).reduce((a, b) => a + b, 0);
    const consumedProtein = Object.values(proteinByMeal).reduce((a, b) => a + b, 0);
    const calorieGoal = Number((clientProfile as any)?.daily_calorie_goal) || 0;
    const remainingKcal = calorieGoal > 0 ? Math.round(calorieGoal - consumedKcal) : null;

    // Which main meals are still ahead, based on the local hour (breakfast<11, lunch<16, dinner<22)
    const mealWindowEnd: Record<string, number> = { breakfast: 11, lunch: 16, dinner: 22 };
    const upcomingMeals = isToday
      ? MEAL_ORDER.filter((m) => !mealTypesLogged.has(m) && localHour < mealWindowEnd[m])
      : [];
    const nextMeal = upcomingMeals[0] || (isEndOfDay ? "tomorrow_breakfast" : "snack");
    const mealProgressText = MEAL_ORDER.map((m) => {
      const logged = mealTypesLogged.has(m);
      return `- ${m}: ${logged ? `LOGGED (${Math.round(kcalByMeal[m] || 0)} kcal, ${Math.round(proteinByMeal[m] || 0)} g protein)` : (localHour >= mealWindowEnd[m] && isToday ? "MISSED (window closed)" : "NOT YET EATEN")}`;
    }).join("\n") + `\n- snack: ${mealTypesLogged.has("snack") ? `LOGGED (${Math.round(kcalByMeal["snack"] || 0)} kcal)` : "none"}`;

    const mealContextBlock = `\n\nDAY PROGRESS TRACKING (authoritative — use this, do not guess):\n${mealProgressText}\nCONSUMED_SO_FAR: ${Math.round(consumedKcal)} kcal, ${Math.round(consumedProtein)} g protein\nDAILY_CALORIE_GOAL: ${calorieGoal > 0 ? calorieGoal : "unknown"}\nREMAINING_KCAL_BUDGET: ${remainingKcal !== null ? remainingKcal : "unknown"}\nUPCOMING_MEALS_TODAY: ${upcomingMeals.length ? upcomingMeals.join(", ") : "none"}\nNEXT_MEAL_TO_ADVISE_ON: ${nextMeal}\n\nHARD RULE — recommendations must target NEXT_MEAL_TO_ADVISE_ON:\n- Every tip in boost_potential.tips must be about ${nextMeal === "tomorrow_breakfast" ? "TOMORROW's meals (start with breakfast)" : `the upcoming ${nextMeal} (and later meals today)`}, with concrete foods and grams that fit REMAINING_KCAL_BUDGET (if known) and close the protein/vegetable gap listed above.\n- NEVER advise changing a meal that is already LOGGED or MISSED — those are in the past. Comment on them only retrospectively, in past tense.\n- Explicitly name the meal in the tip ("На ужин — ...", "Tomorrow at breakfast — ...").\n- If REMAINING_KCAL_BUDGET is known and small (<250), advise a light protein+vegetable option; if the client is far below budget, advise a full balanced plate, never "eat less".`;

    const userContent: unknown[] = [
      {
        type: "text",
        text: `CLIENT_FIRST_NAME: "${firstName}" (address the client by this name in summary_ru and summary_en; in summary_en transliterate it to Latin script, in summary_ru keep/write it in Cyrillic).\nCURRENT_LOCAL_TIME: "${localTimeStr}" (Asia/Nicosia)\nCURRENT_LOCAL_HOUR: ${localHour}\nIS_TODAY: ${isToday}\nHAS_DINNER_LOGGED: ${hasDinner}\nMODE: ${mode}${mealContextBlock}\n\nAnalyze food intake from ${log_date}. There are ${photoCount} food photo(s)${hasManual ? ` and ${manualEntries.length} manual text entries` : ''}. Each photo has a meal type label assigned by the client — you MUST respect the client's meal_type assignment, do NOT reassign photos to different meal types. Return ONLY valid JSON, no markdown.\n\n${photoCount > 0 ? `Photos:\n${photos!.map((p: Record<string, unknown>, i: number) => `Photo ${i + 1}: meal_type="${p.meal_type}", meal_time="${(p as any).meal_time || 'unknown'}" (uploaded at ${(p as any).created_at})`).join('\n')}` : 'No photos uploaded.'}${manualEntriesText}`,
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
        max_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT + `\n\n## UI LANGUAGE OVERRIDE (HARD RULE)\nThe client is currently using the app in language: "${uiLang}" (${uiLang === "en" ? "English" : "Russian"}).\nWrite ALL human-readable feedback strings in THIS language ONLY:\n- every string in "positives" arrays\n- every string in "issues" arrays\n- "swap_ru" / "swap_en" — fill the one matching this language with the real swap; the other field may repeat the same value or be empty\n- "action_ru" / "action_en" in boost_potential.tips — same rule\nKeep BOTH "summary_ru" and "summary_en" present, but the one matching this language must be the primary, polished version (the other can be a faithful translation). Food NAMES inside "detected_foods" and "score_killers.food" stay in their natural language (usually as the client typed them or as seen on the photo) — do NOT translate brand/dish names.\n\n## CRITICAL — TIME-AWARE COACHING (HARD RULE)\nThe user message provides CURRENT_LOCAL_TIME, CURRENT_LOCAL_HOUR (Asia/Nicosia), IS_TODAY, HAS_DINNER_LOGGED and MODE. MODE is either "midday" or "end_of_day". Meal windows in local time: breakfast 06:00–11:00, lunch 11:00–16:00, dinner 16:00–22:00, snack any time.\n\n### MODE = "midday" (analysis after breakfast or lunch — day NOT yet over):\n- This is an IN-THE-MOMENT coaching update, not a final verdict. The day is still in progress.\n- "boost_potential.tips" must be actionable RIGHT NOW: focus on the very next upcoming meal and what to do in the next few hours to push the day's score up.\n- NEVER suggest "add more at breakfast" if breakfast window is past. For past/missed meals, roll the missing protein/veg/fiber into the NEXT upcoming meal (e.g. "на обед добавь 150 г куриной грудки и большой салат — +12") or suggest a protein-rich snack now.\n- The very next upcoming meal is the highest-leverage tip — put it first, sorted by points_gain descending.\n- summary_ru / summary_en must sound like a mid-day check-in: 1) short verdict on what was eaten so far, 2) one concrete next-meal action. Do NOT say "итог дня" / "today's total" — the day is not done.\n\n### MODE = "end_of_day" (dinner logged, or hour ≥ 21, or past day):\n- This is the FINAL day verdict. No more "boost it now" tips for today — the eating window is closed and the client CANNOT change anything that was already eaten today.\n- "boost_potential.tips" must be reframed as plan-for-tomorrow / next-similar-day: 1–3 concrete fixes for TOMORROW's breakfast/lunch/dinner based on what went wrong today. Phrase as "Завтра на завтрак — ..." / "Tomorrow at lunch — ...". Concrete foods and portions, не общие фразы.\n- "boost_potential.achievable_today" = the FINAL overall_score (do not promise points the client can no longer earn today). Set it equal to overall_score.\n- Do NOT suggest eating anything else tonight if hour ≥ 21 — at most water / herbal tea.\n- summary_ru / summary_en = final day verdict + one most important fix for tomorrow, написанные строго через призму методологии Толстиковой (см. блок ниже). Tone: тёплый коуч, подводящий день.\n\n### HARD WORDING RULE for end_of_day (CRITICAL — do not violate):\nПриёмы пищи (завтрак, перекус, обед, ужин), которые уже произошли сегодня, ИЗМЕНИТЬ НЕЛЬЗЯ. Поэтому в end_of_day режиме ЗАПРЕЩЕНО писать формулировки типа:\n- «сегодня стоит улучшить завтрак»\n- «сегодня нужно добавить белок на перекус»\n- «улучши свой завтрак / перекус»\n- любые «сегодня» + «улучшить/добавить/заменить» по отношению к УЖЕ ЗАПИСАННЫМ приёмам.\nВместо этого ВСЕГДА переноси совет в будущее время и привязывай к КОНКРЕТНОМУ будущему приёму:\n- «В следующий раз на завтрак — …»\n- «Завтра на завтрак замени … на …»\n- «На следующий перекус возьми … вместо …»\nРетроспективные замечания о том, что было хорошо/плохо сегодня, давай в прошедшем времени («завтрак сегодня был лёгкий по белку», «перекус выбил день из системы»), и СРАЗУ за ними — конкретный позитивный шаг на ЗАВТРА. Никогда не оставляй клиента с инструкцией, которую он уже физически не может выполнить сегодня.\n\n## КАНОН ТОЛСТИКОВОЙ — методология (применять В end_of_day режиме как основной фильтр; в midday — как фоновый ориентир)\nЕкатерина Толстикова (нутрициолог, Украина) — её подход построен на нескольких жёстких принципах. Применяй их буквально в итоговом разборе дня и в плане на завтра:\n\n1. **Тарелка Толстиковой** — каждый основной приём пищи строится по схеме: ~½ тарелки овощи/зелень (некрахмалистые), ~¼ белок (рыба/птица/нежирное мясо/творог/яйца/бобовые), ~¼ сложные углеводы (гречка, киноа, овсянка, бурый рис, бобовые, цельнозерновой хлеб) + 1 ч. л. полезного жира (оливковое масло, авокадо, орехи). Если в приёме нет одного из элементов — это «несбалансированная тарелка», и это нужно явно назвать.\n2. **Белок в каждый приём пищи** — минимум 20–30 г качественного белка за основной приём. День без белка на завтрак Толстикова считает грубой ошибкой: разгоняет голод и срывы во второй половине дня. Это первое, что нужно чинить.\n3. **Сложные углеводы — в первую половину дня** — основная порция круп/картофеля/хлеба в завтрак и обед. К ужину углеводы минимизируются: только овощи + белок + немного жира.\n4. **Овощи / клетчатка — обязательно** — ≥400 г овощей в день, желательно в каждый основной приём. Толстикова повторяет: «без клетчатки нет ни сытости, ни микробиоты, ни результата».\n5. **Никакой еды без чувства голода и никакой еды по эмоции** — приём пищи только при реальном физическом голоде (3–4 ч после предыдущего). Перекусы «от скуки», «за компанию», «потому что 11 часов» — фиксируем как поведенческую ошибку.\n6. **3 приёма пищи + 1 опциональный перекус** — это базовая структура. Постоянные кусочничества и «дробное питание каждые 2 часа» Толстикова не рекомендует: они мешают восстановлению инсулина и реальному голоду.\n7. **Питьевой режим** — 30 мл чистой воды на 1 кг массы тела (обычно 1.8–2.5 л/день). Кофе, чай, соки в норму не входят. Если за день клиент явно недопил — это отдельный пункт в итоге.\n8. **«Не есть после 19:00» — миф, который Толстикова опровергает** — ужин в 20–21 ч нормален и нужен, если это сбалансированный белково-овощной приём. Поздним считается только приём после ~22:00, и только тогда идёт штраф. НЕ ругай клиента за «поздний ужин», если он был в 19–21 ч и сбалансирован.\n9. **Сахар, мука, алкоголь, ультра-обработка** — главные блокаторы результата. Сладости, выпечка, газировка, соки, фастфуд, колбасы/сосиски, готовые соусы, «пп-десерты» с сиропами — всё это в её методичке проходит как «продукты вне системы». Если такое в дне — это всегда первая проблема в итоге, даже если калории «вписались».\n10. **Способ приготовления** — варка, запекание, гриль, на пару, лёгкая обжарка без панировки. Фритюр, панировка, тяжёлые сливочные/майонезные соусы — минусуем.\n11. **Молочка и глютен — индивидуально** — Толстикова не запрещает их по умолчанию, но если в дне явный перебор молочки/сладкой выпечки + жалобы на отёки/вздутие/кожу (если знаем из контекста) — мягко предложить наблюдение, не запрет.\n12. **Восстановление важнее «жёсткой диеты»** — сон, вода, регулярность приёмов пищи, мягкий дефицит. Категорические голодания, монодиеты, «детоксы» и «сушки» — против её философии. НИКОГДА не советуй пропустить приём пищи или «поголодать завтра, чтобы компенсировать сегодня».\n13. **Принцип 80/20** — 80% времени строго по системе (тарелка, белок, овощи, вода), 20% — гибкость без чувства вины. Один «срыв» НЕ перечёркивает день и не должен подаваться как катастрофа. Тон поддерживающий, без морализаторства.\n14. **Никаких «волшебных продуктов» и БАДов в советах** — только реальная еда. Не рекомендуй спортпит, жиросжигатели, «чудо-смузи», коллаген, L-карнитин и т.п.\n15. **Замены вместо запретов** — формулировка ВСЕГДА позитивная: не «убери булку», а «замени булку на цельнозерновой тост + яйцо + авокадо». Это её фирменный приём.\n\n### Как использовать «Канон Толстиковой» в end_of_day выводе:\n- В summary_ru / summary_en пройди по тарелке дня: был ли белок в каждом приёме, были ли овощи, как распределились углеводы по времени, был ли сахар/мука/ультра-обработка, питьевой режим. Назови 1 главную системную ошибку дня (НЕ список из 5).\n- В boost_potential.tips дай 1–3 конкретных замены/добавки на завтра, сформулированных позитивно («Замени …», «Добавь …», «Перенеси крупу на обед»), каждая — закрывает один из пунктов 1–10 выше. Указывай конкретные продукты и граммовки.\n- НЕ используй слова «диета», «нельзя», «запрещено», «срыв» (как осуждение), «детокс», «голодание», «разгрузочный день».\n- Если день был чистым и по системе — прямо похвали и закрепи поведение («сохрани этот шаблон тарелки на завтра»).\n\nIn BOTH modes: meal-level "issues", "positives", "score_killers" are retrospective and apply to what was actually eaten — unchanged.` },
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
      console.error("Failed to parse AI response (len=" + rawContent.length + "):", rawContent.slice(0, 500), "...", rawContent.slice(-300));
      // Try to salvage top-level score/summary via regex from a truncated response
      const scoreMatch = rawContent.match(/"overall_score"\s*:\s*(\d+)/);
      const sumRuMatch = rawContent.match(/"summary_ru"\s*:\s*"([^"]+)"/);
      const sumEnMatch = rawContent.match(/"summary_en"\s*:\s*"([^"]+)"/);
      analysis = {
        overall_score: scoreMatch ? Number(scoreMatch[1]) : 50,
        meals: [],
        summary_ru: sumRuMatch?.[1] || "Не удалось обработать ответ AI. Попробуйте ещё раз.",
        summary_en: sumEnMatch?.[1] || "Failed to process AI response. Please try again.",
      };
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
    analysis.mode = mode;
    analysis.next_meal = nextMeal;
    analysis.upcoming_meals = upcomingMeals;
    analysis.remaining_kcal = remainingKcal;
    analysis.generated_at_local = `${localDateStr} ${localTimeStr}`;

    // --- Server-side name enforcement: guarantee summary starts with the client's name ---
    // Script-agnostic comparison: transliterate BOTH the name and the text to a latin skeleton,
    // so "Родион" matches "Rodion" and vice versa.
    const CYR_TO_LAT: Record<string, string> = {
      а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
      й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
      у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "",
      э: "e", ю: "yu", я: "ya", і: "i", ї: "i", є: "e", ґ: "g",
    };
    const latinSkeleton = (s: string): string =>
      s.toLowerCase()
        .replace(/[\u0400-\u04FF\u0450-\u045F]/g, (ch) => CYR_TO_LAT[ch] ?? ch)
        .replace(/kh/g, "h")
        .replace(/y/g, "i")
        .replace(/[^a-z]/g, "");

    // Latin spelling of the name, used when injecting into an English summary
    const toLatinName = (s: string): string => {
      const t = s.toLowerCase().replace(/[\u0400-\u04FF]/g, (ch) => CYR_TO_LAT[ch] ?? ch);
      return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
    };

    const ensureNamePrefix = (text: string, name: string, lang: "ru" | "en"): { text: string; injected: boolean } => {
      if (!text || !name) return { text, injected: false };
      const trimmed = text.trim();
      const headSkeleton = latinSkeleton(trimmed.slice(0, 30));
      const nameSkeleton = latinSkeleton(name);
      if (nameSkeleton && headSkeleton.includes(nameSkeleton)) return { text: trimmed, injected: false };
      const displayName = lang === "en" ? toLatinName(name) : name;
      return { text: `${displayName}, ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`, injected: true };
    };

    const summaryRuOrig = String(analysis.summary_ru || "");
    const summaryEnOrig = String(analysis.summary_en || "");
    const ruRes = ensureNamePrefix(summaryRuOrig, firstName, "ru");
    const enRes = ensureNamePrefix(summaryEnOrig, firstName, "en");
    analysis.summary_ru = ruRes.text;
    analysis.summary_en = enRes.text;
    const nameInjectedRu = ruRes.injected;
    const nameInjectedEn = enRes.injected;
    const nameInjected = nameInjectedRu || nameInjectedEn;

    // Alert only when name is missing in the UI-language summary (the one the client actually sees)
    const nameMissingInClientFacing = !nameFallbackUsed && (uiLang === "en" ? nameInjectedEn : nameInjectedRu);
    const nameUsedInSummary = !nameFallbackUsed && !nameInjected;

    if (nameInjected) {
      console.warn(`[analyze-nutrition][NAME] AI omitted name — server INJECTED. user=${user_id} firstName="${firstName}"`);
    }
    analysis.name_debug = {
      first_name: firstName,
      source: nameSource,
      fallback_used: nameFallbackUsed,
      ai_used_name: nameUsedInSummary,
      server_injected: nameInjected,
      full_name: fullName,
    };
    const summaryRuStr = String(analysis.summary_ru || "");

    // --- Save to DB ---
    const { error: upsertError } = await supabase
      .from("nutrition_logs")
      .upsert(
        { user_id, log_date, ai_score: score, ai_feedback: feedback, ai_analysis: analysis },
        { onConflict: "user_id,log_date" }
      );
    if (upsertError) throw upsertError;

    // --- Alert trainer if name was missing or not used ---
    if (nameFallbackUsed || nameMissingInClientFacing) {
      try {
        const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
        const TG_CHAT = Deno.env.get("TELEGRAM_CHAT_ID");
        if (TG_TOKEN && TG_CHAT) {
          const clientFacingSummary = uiLang === "en" ? String(analysis.summary_en || "") : summaryRuStr;
          const reason = nameFallbackUsed
            ? `❌ Имя клиента ПУСТОЕ в профиле (full_name="${fullName}")`
            : `⚠️ AI не обратился по имени "${firstName}" в ${uiLang.toUpperCase()}-саммари (сервер вставил имя автоматически)`;
          const alertMsg = `🚨 <b>Алерт: персонализация питания</b>\n\n${reason}\n\n👤 user_id: <code>${user_id}</code>\n📅 ${log_date}\nUI lang: ${uiLang}\n\n💬 Саммари: ${clientFacingSummary.slice(0, 200)}${clientFacingSummary.length > 200 ? "…" : ""}`;
          await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: TG_CHAT, text: alertMsg, parse_mode: "HTML", disable_web_page_preview: true }),
          });
        }
      } catch (alertErr) {
        console.error("[analyze-nutrition][NAME] alert send failed:", alertErr);
      }
    }

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
