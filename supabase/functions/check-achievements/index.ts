import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Achievement {
  achievement_key: string;
  achievement_type: string;
  title_en: string;
  title_ru: string;
  description_en: string;
  description_ru: string;
  icon: string;
}

// ═══════════ Achievement definitions ═══════════

const NUTRITION_STREAK_MILESTONES: { days: number; icon: string }[] = [
  { days: 3, icon: "📸" },
  { days: 7, icon: "📷" },
  { days: 14, icon: "🎞️" },
  { days: 30, icon: "🌟" },
  { days: 60, icon: "💎" },
  { days: 90, icon: "🔱" },
];

const NUTRITION_QUALITY_LEVELS: { threshold: number; icon: string; label_en: string; label_ru: string }[] = [
  { threshold: 60, icon: "🥉", label_en: "Bronze", label_ru: "Бронза" },
  { threshold: 80, icon: "🥈", label_en: "Silver", label_ru: "Серебро" },
  { threshold: 95, icon: "🥇", label_en: "Gold", label_ru: "Золото" },
];

// Free session rewards for Silver and Gold quality
const FREE_SESSION_QUALITY_THRESHOLDS = [80, 95]; // Silver and Gold

const GOLD_STREAK_WEEKS_FOR_REWARD = 3;
const GOLD_THRESHOLD = 95;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Get the Monday of a given date's week
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

async function grantFreeSession(supabase: any, userId: string, reason: string): Promise<boolean> {
  const { data: activePkg } = await supabase
    .from("client_packages")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!activePkg) return false;

  await supabase
    .from("client_packages")
    .update({ total_sessions: activePkg.total_sessions + 1 })
    .eq("id", activePkg.id);

  await supabase.from("session_ledger").insert({
    user_id: userId,
    package_id: activePkg.id,
    delta: -1,
    reason,
    used_before: activePkg.used_sessions,
    used_after: activePkg.used_sessions,
  });

  return true;
}

async function sendTelegram(token: string, chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) {
    const data = await res.json();
    console.error("Telegram send failed:", data);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const userId = user.id;

    // Fetch existing achievements
    const { data: existingAchievements } = await supabase
      .from("client_achievements")
      .select("achievement_key")
      .eq("user_id", userId);
    const existingKeys = new Set((existingAchievements || []).map((a: { achievement_key: string }) => a.achievement_key));

    const newAchievements: Achievement[] = [];
    let freeSessionGranted = false;

    // ═══════════ 1. Nutrition Logging Streak ═══════════
    const { data: foodPhotoDates } = await supabase
      .from("food_photos")
      .select("log_date")
      .eq("user_id", userId)
      .order("log_date", { ascending: false });

    if (foodPhotoDates && foodPhotoDates.length > 0) {
      const uniqueDates = [...new Set(foodPhotoDates.map((p: { log_date: string }) => p.log_date))].sort().reverse();
      
      let streak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < uniqueDates.length; i++) {
        const expectedDate = new Date(today);
        expectedDate.setDate(expectedDate.getDate() - i);
        const expectedStr = expectedDate.toISOString().split("T")[0];
        
        if (uniqueDates.includes(expectedStr)) {
          streak++;
        } else {
          break;
        }
      }

      for (const milestone of NUTRITION_STREAK_MILESTONES) {
        const key = `nutrition_streak_${milestone.days}`;
        if (!existingKeys.has(key) && streak >= milestone.days) {
          newAchievements.push({
            achievement_key: key,
            achievement_type: "nutrition_streak",
            title_en: `${milestone.days}-Day Streak`,
            title_ru: `${milestone.days} дней подряд`,
            description_en: `Logged food for ${milestone.days} consecutive days!`,
            description_ru: `Фото еды ${milestone.days} дней подряд!`,
            icon: milestone.icon,
          });
        }
      }
    }

    // ═══════════ 2. Weekly Nutrition Quality ═══════════
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];

    const { data: nutritionLogs } = await supabase
      .from("nutrition_logs")
      .select("ai_score, log_date")
      .eq("user_id", userId)
      .gte("log_date", weekAgoStr)
      .not("ai_score", "is", null);

    if (nutritionLogs && nutritionLogs.length >= 3) {
      const avgScore = Math.round(
        nutritionLogs.reduce((sum: number, l: { ai_score: number }) => sum + l.ai_score, 0) / nutritionLogs.length
      );

      for (const level of NUTRITION_QUALITY_LEVELS) {
        const key = `nutrition_quality_week_${level.threshold}`;
        if (!existingKeys.has(key) && avgScore >= level.threshold) {
          // Check if this quality level grants a free session
          const grantsFreeSession = FREE_SESSION_QUALITY_THRESHOLDS.includes(level.threshold);
          
          newAchievements.push({
            achievement_key: key,
            achievement_type: "nutrition_quality",
            title_en: `${level.label_en} Nutrition`,
            title_ru: `${level.label_ru} питания`,
            description_en: grantsFreeSession
              ? `Weekly average nutrition score ≥ ${level.threshold}%! Free session earned!`
              : `Weekly average nutrition score ≥ ${level.threshold}%!`,
            description_ru: grantsFreeSession
              ? `Средний балл питания за неделю ≥ ${level.threshold}%! Бесплатная тренировка!`
              : `Средний балл питания за неделю ≥ ${level.threshold}%!`,
            icon: level.icon,
          });

          // Grant free session for Silver and Gold
          if (grantsFreeSession) {
            const granted = await grantFreeSession(
              supabase, userId,
              `${level.label_en} nutrition quality reward (avg ${avgScore}%)`
            );
            if (granted) freeSessionGranted = true;

            // Telegram notifications
            try {
              const { data: clientProfile } = await supabase
                .from("profiles")
                .select("full_name, telegram_chat_id")
                .eq("user_id", userId)
                .single();

              const clientName = clientProfile?.full_name || "Unknown";
              const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
              const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

              if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
                const trainerMsg = `🎁 <b>${level.label_en} Nutrition Reward!</b>\n\n👤 <b>${clientName}</b> получил ${level.label_ru} рейтинг питания (${avgScore}%)!\n\n🏋️ +1 бесплатная тренировка автоматически добавлена в пакет.\n\n${level.icon}${level.icon}${level.icon}`;
                await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, trainerMsg);

                if (clientProfile?.telegram_chat_id) {
                  const clientMsg = `🎁 <b>Поздравляем!</b>\n\nВы получили ${level.label_ru} рейтинг питания (${avgScore}%)!\n\n🏋️ +1 бесплатная тренировка добавлена в ваш пакет!\n\nПродолжайте в том же духе! 💪${level.icon}`;
                  await sendTelegram(TELEGRAM_BOT_TOKEN, clientProfile.telegram_chat_id, clientMsg);
                }
              }
            } catch (tgErr) {
              console.error("Failed to send nutrition reward Telegram notification:", tgErr);
            }
          }
        }
      }
    }

    // ═══════════ 3. Gold Streak Reward (3 consecutive weeks → free session) ═══════════
    // Get last 4 weeks of nutrition logs to check for 3 consecutive gold weeks
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const fourWeeksAgoStr = fourWeeksAgo.toISOString().split("T")[0];

    const { data: recentNutritionLogs } = await supabase
      .from("nutrition_logs")
      .select("ai_score, log_date")
      .eq("user_id", userId)
      .gte("log_date", fourWeeksAgoStr)
      .not("ai_score", "is", null)
      .order("log_date", { ascending: true });

    if (recentNutritionLogs && recentNutritionLogs.length > 0) {
      const weekScores: Record<string, number[]> = {};
      for (const log of recentNutritionLogs) {
        const weekStart = getWeekStart(new Date(log.log_date + "T00:00:00"));
        if (!weekScores[weekStart]) weekScores[weekStart] = [];
        weekScores[weekStart].push(log.ai_score);
      }

      const sortedWeeks = Object.keys(weekScores).sort();
      const weekAverages: { week: string; avg: number }[] = [];
      for (const week of sortedWeeks) {
        const scores = weekScores[week];
        if (scores.length >= 3) {
          const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
          weekAverages.push({ week, avg });
        }
      }

      let consecutiveGold = 0;
      for (let i = weekAverages.length - 1; i >= 0; i--) {
        if (weekAverages[i].avg >= GOLD_THRESHOLD) {
          consecutiveGold++;
        } else {
          break;
        }
      }

      if (consecutiveGold >= GOLD_STREAK_WEEKS_FOR_REWARD) {
        const rewardCycle = Math.floor(consecutiveGold / GOLD_STREAK_WEEKS_FOR_REWARD);
        const rewardKey = `gold_streak_reward_${rewardCycle}`;

        if (!existingKeys.has(rewardKey)) {
          newAchievements.push({
            achievement_key: rewardKey,
            achievement_type: "gold_streak_reward",
            title_en: `Gold Streak x${rewardCycle}`,
            title_ru: `Gold серия x${rewardCycle}`,
            description_en: `${consecutiveGold} consecutive weeks of Gold nutrition! Free session earned!`,
            description_ru: `${consecutiveGold} недель Gold питания подряд! Бесплатная тренировка!`,
            icon: "🎁",
          });

          const granted = await grantFreeSession(
            supabase, userId,
            `Gold nutrition streak reward (${consecutiveGold} weeks)`
          );
          if (granted) freeSessionGranted = true;

          try {
            const { data: clientProfile } = await supabase
              .from("profiles")
              .select("full_name, telegram_chat_id")
              .eq("user_id", userId)
              .single();

            const clientName = clientProfile?.full_name || "Unknown";
            const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
            const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

            if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
              const trainerMsg = `🎁 <b>Gold Streak Reward!</b>\n\n👤 <b>${clientName}</b> получил Gold рейтинг питания <b>${consecutiveGold} недель подряд!</b>\n\n🏋️ +1 бесплатная тренировка автоматически добавлена в пакет.\n\n🥇🥇🥇`;
              await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, trainerMsg);

              if (clientProfile?.telegram_chat_id) {
                const clientMsg = `🎁 <b>Поздравляем!</b>\n\nВы получили Gold рейтинг питания <b>${consecutiveGold} недель подряд!</b>\n\n🏋️ В награду +1 бесплатная тренировка добавлена в ваш пакет!\n\nПродолжайте в том же духе! 💪🥇`;
                await sendTelegram(TELEGRAM_BOT_TOKEN, clientProfile.telegram_chat_id, clientMsg);
              }
            }
          } catch (tgErr) {
            console.error("Failed to send gold reward Telegram notification:", tgErr);
          }
        }
      }
    }

    // ═══════════ Save new achievements ═══════════
    if (newAchievements.length > 0) {
      const rows = newAchievements.map((a) => ({
        user_id: userId,
        ...a,
      }));

      const { error } = await supabase
        .from("client_achievements")
        .upsert(rows, { onConflict: "user_id,achievement_key" });

      if (error) {
        console.error("Failed to save achievements:", error);
        throw error;
      }
    }

    // Return all achievements
    const { data: allAchievements } = await supabase
      .from("client_achievements")
      .select("*")
      .eq("user_id", userId)
      .order("earned_at", { ascending: false });

    return jsonResponse({
      achievements: allAchievements || [],
      new_achievements: newAchievements,
      free_session_granted: freeSessionGranted,
    });
  } catch (e) {
    console.error("check-achievements error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
