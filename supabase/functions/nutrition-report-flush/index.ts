import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// Send the trainer report only after the client stopped editing the diary for this long
const QUIET_MINUTES = 25;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const TG_CHAT = Deno.env.get("TELEGRAM_CHAT_ID");

  try {
    const body = await req.json().catch(() => ({}));
    const quietMinutes = typeof body?.quiet_minutes === "number" ? body.quiet_minutes : QUIET_MINUTES;
    const cutoff = new Date(Date.now() - quietMinutes * 60_000).toISOString();

    const { data: logs, error } = await supabase
      .from("nutrition_logs")
      .select("id, user_id, log_date, ai_score, ai_feedback, ai_analysis, manual_entries")
      .eq("report_pending", true)
      .lt("report_marked_at", cutoff)
      .limit(20);

    if (error) throw error;
    if (!logs || logs.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    const appUrl = "https://my-fitness-coach-app.lovable.app";

    for (const log of logs) {
      const analysis = (log.ai_analysis || {}) as Record<string, unknown>;
      const score = Number(log.ai_score ?? 0);

      const { data: profile } = await supabase
        .from("profiles").select("full_name").eq("user_id", log.user_id).single();

      const clientName = profile?.full_name || "Клиент";
      const summaryRu = (analysis.summary_ru || analysis.summary_en || log.ai_feedback || "") as string;
      const scoreEmoji = score >= 75 ? "🟢" : score >= 50 ? "🟡" : "🔴";

      const meals = (analysis.meals as Array<Record<string, unknown>>) || [];
      const mealsDetail = meals.map((m) => {
        const mealScore = (m.score as number) || 0;
        const mealEmoji = mealScore >= 75 ? "✅" : mealScore >= 50 ? "⚠️" : "❌";
        const detectedFoods = (m.detected_foods as Array<Record<string, unknown>>) || [];
        const foods = detectedFoods.map((f) =>
          typeof f === "string" ? f : `${f.name}${f.portion_g ? ` (${f.portion_g}g)` : ""} — ${f.calories || 0}kcal`
        ).join(", ");
        return `${mealEmoji} <b>${m.meal_type}</b> — ${mealScore}/100${foods ? `\n   ${foods}` : ""}`;
      }).join("\n");

      // Manual entries linked to a photo come from AI recognition, the rest are typed by the client
      const entries = ((log.manual_entries || []) as Array<Record<string, unknown>>);
      const fmt = (e: Record<string, unknown>) =>
        `${e.name || "Quick add"} — ${e.calories || 0}kcal (P${e.protein_g || 0} C${e.carbs_g || 0} F${e.fat_g || 0})`;
      const fromPhoto = entries.filter((e) => e.photo_id);
      const typed = entries.filter((e) => !e.photo_id);

      let detail = "";
      if (fromPhoto.length > 0) {
        detail += `\n\n📷 <b>С фото (AI):</b>\n${fromPhoto.map((e) => `• ${fmt(e)}`).join("\n")}`;
      }
      if (typed.length > 0) {
        detail += `\n\n✏️ <b>Ручной ввод:</b>\n${typed.map((e) => `• ${fmt(e)}`).join("\n")}`;
      }

      const msg = `🍽 <b>Дневник питания — итог дня</b>\n\n👤 ${clientName}\n📅 ${log.log_date}\n${scoreEmoji} Оценка: <b>${score}/100</b>\n\n${mealsDetail ? mealsDetail + "\n" : ""}${detail}\n\n💬 ${summaryRu}\n\n🔗 <a href="${appUrl}">Открыть приложение</a>`;

      if (TG_TOKEN && TG_CHAT) {
        const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: TG_CHAT, text: msg, parse_mode: "HTML", disable_web_page_preview: true }),
        });
        if (!res.ok) {
          console.error("[nutrition-report-flush] telegram error:", await res.text());
          continue;
        }
      }

      await supabase
        .from("nutrition_logs")
        .update({ report_pending: false, report_sent_at: new Date().toISOString() })
        .eq("id", log.id);

      sent++;
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[nutrition-report-flush] error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
