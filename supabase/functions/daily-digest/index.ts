import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const esc = (s: string) =>
  (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const TZ = "Asia/Nicosia";

// YYYY-MM-DD in Cyprus time
function cyprusDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const day: string = typeof body?.date === "string" ? body.date : cyprusDate();
    const dryRun = body?.dry_run === true;

    // Cyprus day boundaries in UTC (Cyprus is UTC+2/+3; use the offset of that day)
    const dayStartUtc = new Date(`${day}T00:00:00+03:00`).toISOString();
    const dayEndUtc = new Date(`${day}T23:59:59.999+03:00`).toISOString();

    const [
      sessionsRes,
      newProfilesRes,
      guestRes,
      nutritionRes,
      photosRes,
      measurementsRes,
      achievementsRes,
      testsRes,
      packagesRes,
      ledgerRes,
    ] = await Promise.all([
      supabase.from("scheduled_sessions")
        .select("id, user_id, session_time, is_recurring, is_deducted")
        .eq("session_date", day),
      supabase.from("profiles")
        .select("user_id, full_name, preferred_language, created_at")
        .gte("created_at", dayStartUtc).lte("created_at", dayEndUtc),
      supabase.from("guest_bookings")
        .select("guest_name, session_date, session_time, status, created_at")
        .gte("created_at", dayStartUtc).lte("created_at", dayEndUtc),
      supabase.from("nutrition_logs")
        .select("user_id, ai_score, water_ml, ai_analysis, manual_entries")
        .eq("log_date", day),
      supabase.from("food_photos").select("user_id").eq("log_date", day),
      supabase.from("body_measurements").select("user_id").eq("measured_at", day),
      supabase.from("client_achievements")
        .select("user_id, title_ru")
        .gte("earned_at", dayStartUtc).lte("earned_at", dayEndUtc),
      supabase.from("test_results")
        .select("user_id, overall_percentage, test_type")
        .gte("created_at", dayStartUtc).lte("created_at", dayEndUtc),
      supabase.from("client_packages")
        .select("user_id, total_sessions, used_sessions, is_active")
        .eq("is_active", true),
      supabase.from("session_ledger")
        .select("user_id, delta, reason")
        .gte("created_at", dayStartUtc).lte("created_at", dayEndUtc),
    ]);

    const sessions = sessionsRes.data ?? [];
    const newProfiles = newProfilesRes.data ?? [];
    const guests = guestRes.data ?? [];
    const nutrition = nutritionRes.data ?? [];
    const photos = photosRes.data ?? [];
    const measurements = measurementsRes.data ?? [];
    const achievements = achievementsRes.data ?? [];
    const tests = testsRes.data ?? [];
    const packages = packagesRes.data ?? [];
    const ledger = ledgerRes.data ?? [];

    // Resolve names for all mentioned users
    const ids = Array.from(new Set([
      ...sessions.map((s: any) => s.user_id),
      ...nutrition.map((n: any) => n.user_id),
      ...photos.map((p: any) => p.user_id),
      ...measurements.map((m: any) => m.user_id),
      ...achievements.map((a: any) => a.user_id),
      ...tests.map((t: any) => t.user_id),
      ...packages.map((p: any) => p.user_id),
      ...ledger.map((l: any) => l.user_id),
    ].filter(Boolean)));

    const nameById = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles").select("user_id, full_name").in("user_id", ids);
      for (const p of profs ?? []) nameById.set(p.user_id, p.full_name || "Без имени");
    }
    const nm = (id: string) => esc(nameById.get(id) || "клиент");

    // --- Тренировки ---
    const sessionLines = sessions
      .sort((a: any, b: any) => String(a.session_time).localeCompare(String(b.session_time)))
      .map((s: any) => {
        const t = s.session_time ? String(s.session_time).slice(0, 5) : "—";
        const mark = s.is_deducted ? "✅" : "🕐";
        return `${mark} ${t} — ${nm(s.user_id)}${s.is_recurring ? " (серия)" : ""}`;
      });

    // --- Активность в приложении ---
    const photoByUser = new Map<string, number>();
    for (const p of photos) photoByUser.set(p.user_id, (photoByUser.get(p.user_id) || 0) + 1);

    const nutritionLines = nutrition.map((n: any) => {
      const kcal = Math.round(Number(n?.ai_analysis?.total_calories ?? n?.ai_analysis?.calories ?? 0));
      const ph = photoByUser.get(n.user_id) || 0;
      const parts = [
        kcal ? `${kcal} ккал` : null,
        n.ai_score != null ? `оценка ${n.ai_score}` : null,
        ph ? `${ph} фото` : null,
        n.water_ml ? `${n.water_ml} мл воды` : null,
      ].filter(Boolean).join(", ");
      return `• ${nm(n.user_id)} — ${parts || "запись без данных"}`;
    });

    // Пользователи, которые залили фото, но без записи в дневнике
    for (const [uid, count] of photoByUser) {
      if (!nutrition.some((n: any) => n.user_id === uid)) {
        nutritionLines.push(`• ${nm(uid)} — ${count} фото`);
      }
    }

    // --- Остатки и долги ---
    const debts: string[] = [];
    const lowBalance: string[] = [];
    for (const p of packages) {
      const left = (p.total_sessions ?? 0) - (p.used_sessions ?? 0);
      if (left < 0) debts.push(`• ${nm(p.user_id)} — долг ${Math.abs(left)}`);
      else if (left <= 1) lowBalance.push(`• ${nm(p.user_id)} — осталось ${left}`);
    }

    const deducted = ledger.filter((l: any) => l.delta < 0).length;
    const refunded = ledger.filter((l: any) => l.delta > 0).length;

    const activeUsers = new Set([
      ...nutrition.map((n: any) => n.user_id),
      ...photos.map((p: any) => p.user_id),
      ...measurements.map((m: any) => m.user_id),
      ...tests.map((t: any) => t.user_id),
    ]);

    const dayLabel = new Date(`${day}T12:00:00`).toLocaleDateString("ru-RU", {
      day: "2-digit", month: "long", weekday: "short",
    });

    const L: string[] = [];
    L.push(`📊 <b>Итоги дня — ${esc(dayLabel)}</b>`);
    L.push("");
    L.push(
      `🏋️ Тренировок: <b>${sessions.length}</b>  •  ` +
      `🆕 Регистраций: <b>${newProfiles.length}</b>  •  ` +
      `📱 Активных в приложении: <b>${activeUsers.size}</b>`,
    );

    if (sessionLines.length) {
      L.push("", "<b>Тренировки</b>", ...sessionLines);
    } else {
      L.push("", "<b>Тренировки</b>", "— сегодня не было");
    }

    if (newProfiles.length) {
      L.push("", "<b>Новые клиенты</b>", ...newProfiles.map((p: any) =>
        `• ${esc(p.full_name || "Без имени")} (${p.preferred_language === "en" ? "EN" : "RU"})`));
    }

    if (guests.length) {
      L.push("", "<b>Заявки гостей</b>", ...guests.map((g: any) =>
        `• ${esc(g.guest_name)} → ${g.session_date}${g.session_time ? " " + String(g.session_time).slice(0, 5) : ""} (${esc(g.status)})`));
    }

    if (nutritionLines.length) {
      L.push("", "<b>Дневник питания</b>", ...nutritionLines);
    }

    if (measurements.length) {
      const uniq = Array.from(new Set(measurements.map((m: any) => m.user_id)));
      L.push("", "<b>Замеры</b>", ...uniq.map((u) => `• ${nm(u as string)}`));
    }

    if (tests.length) {
      L.push("", "<b>Тесты</b>", ...tests.map((t: any) =>
        `• ${nm(t.user_id)} — ${t.overall_percentage}% (${esc(t.test_type)})`));
    }

    if (achievements.length) {
      L.push("", "<b>Достижения</b>", ...achievements.map((a: any) =>
        `• ${nm(a.user_id)} — ${esc(a.title_ru)}`));
    }

    if (deducted || refunded) {
      L.push("", `<b>Списания</b>: -${deducted} / возвраты: +${refunded}`);
    }

    if (debts.length) L.push("", "🔴 <b>Долги</b>", ...debts);
    if (lowBalance.length) L.push("", "⚠️ <b>Заканчиваются занятия</b>", ...lowBalance);

    const text = L.join("\n");

    if (dryRun) {
      return new Response(JSON.stringify({ ok: true, dry_run: true, text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const TG_CHAT = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!TG_TOKEN || !TG_CHAT) throw new Error("Telegram credentials are not configured");

    const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CHAT,
        text: text.slice(0, 4000),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const tg = await res.json();
    if (!res.ok || tg?.ok === false) {
      console.error("Telegram error:", res.status, JSON.stringify(tg));
      return new Response(JSON.stringify({ error: "Telegram send failed", details: tg }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, date: day, sessions: sessions.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-digest failed:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
