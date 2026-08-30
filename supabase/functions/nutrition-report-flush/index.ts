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

    const cols = "id, user_id, log_date, ai_score, ai_feedback, ai_analysis, manual_entries";

    const { data: pendingLogs, error } = await supabase
      .from("nutrition_logs")
      .select(cols)
      .eq("report_pending", true)
      .lt("report_marked_at", cutoff)
      .limit(20);

    if (error) throw error;

    // Safety net: the day has food but the AI analysis never ran (voice/manual entries
    // added while the app was closed, AI error, etc.). The trainer must still get the
    // day summary once the client stopped editing.
    const since = new Date(Date.now() - 3 * 24 * 3600_000).toISOString().slice(0, 10);
    const { data: orphanLogs } = await supabase
      .from("nutrition_logs")
      .select(cols + ", updated_at")
      .is("report_sent_at", null)
      .eq("report_pending", false)
      .gte("log_date", since)
      .lt("updated_at", cutoff)
      .limit(20);

    const seen = new Set((pendingLogs ?? []).map((l) => l.id));
    const logs = [
      ...(pendingLogs ?? []),
      ...((orphanLogs ?? []) as Array<Record<string, unknown>>).filter((l) =>
        !seen.has(l.id as string) &&
        Array.isArray(l.manual_entries) &&
        (l.manual_entries as unknown[]).length > 0
      ),
    ] as Array<Record<string, any>>;

    if (logs.length === 0) {
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

      // Entries are grouped by how the client added them: photo (AI), voice, or typed by hand
      const entries = ((log.manual_entries || []) as Array<Record<string, unknown>>);
      const fmt = (e: Record<string, unknown>) =>
        `${e.name || "Quick add"} — ${e.calories || 0}kcal (P${e.protein_g || 0} C${e.carbs_g || 0} F${e.fat_g || 0})`;
      const fromPhoto = entries.filter((e) => e.photo_id || e.source === "photo");
      const fromVoice = entries.filter((e) => !e.photo_id && e.source === "voice");
      const typed = entries.filter((e) => !e.photo_id && e.source !== "voice" && e.source !== "photo");

      let detail = "";
      if (fromPhoto.length > 0) {
        detail += `\n\n📷 <b>С фото (AI):</b>\n${fromPhoto.map((e) => `• ${fmt(e)}`).join("\n")}`;
      }
      if (fromVoice.length > 0) {
        detail += `\n\n🎤 <b>Голосом (надиктовано):</b>\n${fromVoice.map((e) => `• ${fmt(e)}`).join("\n")}`;
      }
      if (typed.length > 0) {
        detail += `\n\n✏️ <b>Ручной ввод:</b>\n${typed.map((e) => `• ${fmt(e)}`).join("\n")}`;
      }

      const sourceParts = [
        fromPhoto.length ? `📷 фото: ${fromPhoto.length}` : null,
        fromVoice.length ? `🎤 голос: ${fromVoice.length}` : null,
        typed.length ? `✏️ вручную: ${typed.length}` : null,
      ].filter(Boolean).join("  •  ");
      const sourceLine = sourceParts ? `\n🧾 Способ ввода: ${sourceParts}` : "";

      const msg = `🍽 <b>Дневник питания — итог дня</b>\n\n👤 ${clientName}\n📅 ${log.log_date}\n${scoreEmoji} Оценка: <b>${score}/100</b>${sourceLine}\n\n${mealsDetail ? mealsDetail + "\n" : ""}${detail}\n\n💬 ${summaryRu}\n\n🔗 <a href="${appUrl}">Открыть приложение</a>`;

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
