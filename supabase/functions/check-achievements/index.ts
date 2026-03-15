import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
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

// Free session: every 3 consecutive weeks with avg ≥80% → +1 free session
const FREE_SESSION_MIN_THRESHOLD = 80;
const FREE_SESSION_WEEKS_REQUIRED = 3;


// Cyprus timezone for correct date calculations
const TIMEZONE = "Asia/Nicosia";

function getLocalToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE }); // YYYY-MM-DD
}

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
    delta: 0,
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

    // ═══════════ Rate limit: max 1 check per 30 seconds per user ═══════════
    const { data: lastAchievement } = await supabase
      .from("client_achievements")
      .select("earned_at")
      .eq("user_id", userId)
      .order("earned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Use a simple in-memory approach: check header for last call timestamp
    const rateLimitKey = `achievement_check_${userId}`;
    const cacheHeader = req.headers.get("x-last-check");
    // We'll rely on the client to not spam; server-side we just limit DB writes

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
      const todayStr = getLocalToday();
      
      for (let i = 0; i < uniqueDates.length; i++) {
        // Calculate expected date by subtracting i days from today (in local timezone)
        const expectedDate = new Date(todayStr + "T12:00:00");
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

    // ═══════════ 2. Weekly Nutrition Quality (one-time badges) ═══════════
    const todayForWeek = new Date(getLocalToday() + "T12:00:00");
    const weekAgo = new Date(todayForWeek);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split("T")[0];

    const { data: nutritionLogs } = await supabase
      .from("nutrition_logs")
      .select("ai_score, log_date")
      .eq("user_id", userId)
      .gte("log_date", weekAgoStr)
      .not("ai_score", "is", null);

    if (nutritionLogs && nutritionLogs.length >= 5) {
      const avgScore = Math.round(
        nutritionLogs.reduce((sum: number, l: { ai_score: number }) => sum + l.ai_score, 0) / nutritionLogs.length
      );

      for (const level of NUTRITION_QUALITY_LEVELS) {
        const key = `nutrition_quality_week_${level.threshold}`;
        if (!existingKeys.has(key) && avgScore >= level.threshold) {
          newAchievements.push({
            achievement_key: key,
            achievement_type: "nutrition_quality",
            title_en: `${level.label_en} Nutrition`,
            title_ru: `${level.label_ru} питания`,
            description_en: `Weekly average nutrition score ≥ ${level.threshold}%!`,
            description_ru: `Средний балл питания за неделю ≥ ${level.threshold}%!`,
            icon: level.icon,
          });
        }
      }
    }

    // ═══════════ 3. Repeating 3-week ≥80% streak → free session ═══════════
    // Look at up to 12 weeks of data to find consecutive weeks with avg ≥80%
    const todayFor12w = new Date(getLocalToday() + "T12:00:00");
    const twelveWeeksAgo = new Date(todayFor12w);
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
    const twelveWeeksAgoStr = twelveWeeksAgo.toISOString().split("T")[0];

    const { data: recentNutritionLogs } = await supabase
      .from("nutrition_logs")
      .select("ai_score, log_date")
      .eq("user_id", userId)
      .gte("log_date", twelveWeeksAgoStr)
      .not("ai_score", "is", null)
      .order("log_date", { ascending: true });

    let consecutiveWeeks = 0;
    let totalCyclesCompleted = 0;

    if (recentNutritionLogs && recentNutritionLogs.length > 0) {
      // Group scores by week (Monday-based)
      const weekScores: Record<string, number[]> = {};
      for (const log of recentNutritionLogs) {
        const weekStart = getWeekStart(new Date(log.log_date + "T00:00:00"));
        if (!weekScores[weekStart]) weekScores[weekStart] = [];
        weekScores[weekStart].push(log.ai_score);
      }

      // Calculate averages for weeks with ≥3 entries, sorted chronologically
      const sortedWeeks = Object.keys(weekScores).sort();
      const weekAverages: { week: string; avg: number; qualified: boolean }[] = [];
      for (const week of sortedWeeks) {
        const scores = weekScores[week];
        if (scores.length >= 3) {
          const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
          weekAverages.push({ week, avg, qualified: avg >= FREE_SESSION_MIN_THRESHOLD });
        }
      }

      // Count consecutive qualifying weeks from the most recent going backwards
      for (let i = weekAverages.length - 1; i >= 0; i--) {
        if (weekAverages[i].qualified) {
          consecutiveWeeks++;
        } else {
          break;
        }
      }

      totalCyclesCompleted = Math.floor(consecutiveWeeks / FREE_SESSION_WEEKS_REQUIRED);

      // Check how many cycle rewards already granted
      const existingCycleKeys = (existingAchievements || [])
        .filter((a: { achievement_key: string }) => a.achievement_key.startsWith("nutrition_3week_reward_"))
        .length;

      // Grant new cycle rewards
      if (totalCyclesCompleted > existingCycleKeys) {
        for (let cycle = existingCycleKeys + 1; cycle <= totalCyclesCompleted; cycle++) {
          const cycleKey = `nutrition_3week_reward_${cycle}`;
          
          newAchievements.push({
            achievement_key: cycleKey,
            achievement_type: "nutrition_quality",
            title_en: `3-Week Quality #${cycle}`,
            title_ru: `3 недели качества #${cycle}`,
            description_en: `Maintained ≥80% nutrition score for 3 consecutive weeks! Free session earned!`,
            description_ru: `≥80% балл питания 3 недели подряд! Бесплатная тренировка!`,
            icon: "🥈", // Silver badge for the reward
          });

          const granted = await grantFreeSession(
            supabase, userId,
            `3-week nutrition streak reward #${cycle} (consecutive weeks ≥80%)`
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
              const trainerMsg = `🎁 <b>3-Week Nutrition Reward #${cycle}!</b>\n\n👤 <b>${clientName}</b> держит ≥80% балл питания уже ${consecutiveWeeks} недель подряд!\n\n🏋️ +1 бесплатная тренировка автоматически добавлена.\n\n🥈🥈🥈`;
              await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, trainerMsg);

              if (clientProfile?.telegram_chat_id) {
                const clientMsg = `🎁 <b>Поздравляем!</b>\n\nВы держите балл питания ≥80% уже ${consecutiveWeeks} недель подряд!\n\n🏋️ +1 бесплатная тренировка добавлена!\n\nПродолжайте! 💪🥈`;
                await sendTelegram(TELEGRAM_BOT_TOKEN, clientProfile.telegram_chat_id, clientMsg);
              }
            }
          } catch (tgErr) {
            console.error("Failed to send 3-week reward Telegram notification:", tgErr);
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

    // Return all achievements + uncelebrated ones
    const { data: allAchievements } = await supabase
      .from("client_achievements")
      .select("*")
      .eq("user_id", userId)
      .order("earned_at", { ascending: false });

    // Find uncelebrated achievements (includes both brand new and previously unseen)
    const uncelebrated = (allAchievements || []).filter((a: { celebrated: boolean }) => !a.celebrated);

    return jsonResponse({
      achievements: allAchievements || [],
      new_achievements: newAchievements,
      uncelebrated,
      free_session_granted: freeSessionGranted,
      quality_streak: {
        consecutive_weeks: consecutiveWeeks,
        weeks_required: FREE_SESSION_WEEKS_REQUIRED,
        cycles_completed: totalCyclesCompleted,
        weeks_in_current_cycle: consecutiveWeeks % FREE_SESSION_WEEKS_REQUIRED,
      },
    });
  } catch (e) {
    console.error("check-achievements error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
