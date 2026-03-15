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

const SESSION_MILESTONES: { count: number; icon: string }[] = [
  { count: 1, icon: "🎯" },
  { count: 5, icon: "💪" },
  { count: 10, icon: "🔥" },
  { count: 25, icon: "⭐" },
  { count: 50, icon: "🏅" },
  { count: 100, icon: "🏆" },
  { count: 200, icon: "👑" },
];

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

    // ═══════════ 1. Session Milestones ═══════════
    const { count: sessionCount } = await supabase
      .from("scheduled_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_deducted", true);

    for (const milestone of SESSION_MILESTONES) {
      const key = `session_milestone_${milestone.count}`;
      if (!existingKeys.has(key) && (sessionCount || 0) >= milestone.count) {
        newAchievements.push({
          achievement_key: key,
          achievement_type: "session_milestone",
          title_en: `${milestone.count} Sessions`,
          title_ru: `${milestone.count} тренировок`,
          description_en: `Completed ${milestone.count} training sessions!`,
          description_ru: `Завершено ${milestone.count} тренировок!`,
          icon: milestone.icon,
        });
      }
    }

    // ═══════════ 2. Nutrition Logging Streak ═══════════
    const { data: foodPhotoDates } = await supabase
      .from("food_photos")
      .select("log_date")
      .eq("user_id", userId)
      .order("log_date", { ascending: false });

    if (foodPhotoDates && foodPhotoDates.length > 0) {
      // Get unique dates
      const uniqueDates = [...new Set(foodPhotoDates.map((p: { log_date: string }) => p.log_date))].sort().reverse();
      
      // Calculate current streak from today
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

    // ═══════════ 3. Weekly Nutrition Quality ═══════════
    // Get last 7 days of nutrition scores
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
    });
  } catch (e) {
    console.error("check-achievements error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
