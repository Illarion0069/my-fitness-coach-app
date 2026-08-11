import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const esc = (s: string) =>
  (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const TZ = "Asia/Nicosia";

function cyprusDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function top<T>(counts: Map<T, number>, n: number): [T, number][] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function bump<T>(m: Map<T, number>, k: T, by = 1) {
  m.set(k, (m.get(k) || 0) + by);
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

    const dayStartUtc = new Date(`${day}T00:00:00+03:00`).toISOString();
    const dayEndUtc = new Date(`${day}T23:59:59.999+03:00`).toISOString();

    const [eventsRes, profilesRes] = await Promise.all([
      supabase.from("app_events")
        .select("user_id, anon_id, event_type, label, path, device, created_at")
        .gte("created_at", dayStartUtc).lte("created_at", dayEndUtc)
        .order("created_at", { ascending: true })
        .limit(20000),
      supabase.from("profiles").select("user_id, full_name, created_at"),
    ]);

    const events = eventsRes.data || [];
    const profiles = profilesRes.data || [];

    const nameOf = new Map<string, string>();
    const isNewClient = new Set<string>();
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    for (const p of profiles) {
      nameOf.set(p.user_id, p.full_name || "Клиент");
      if (new Date(p.created_at).getTime() >= weekAgo) isNewClient.add(p.user_id);
    }

    // --- Агрегация ---
    const visitorsAll = new Set<string>();
    const visitorsGuests = new Set<string>();
    const visitorsClients = new Set<string>();
    const visitorsNew = new Set<string>();

    const screensAll = new Map<string, number>();
    const clicksClients = new Map<string, number>();
    const clicksNew = new Map<string, number>();
    const clicksGuests = new Map<string, number>();
    const devices = new Map<string, number>();
    const perClient = new Map<string, number>();
    const firstSeen = new Map<string, string>();
    const lastSeen = new Map<string, string>();

    for (const e of events) {
      const vid = e.user_id || e.anon_id;
      visitorsAll.add(vid);
      devices.set(e.device || "?", (devices.get(e.device || "?") || 0) + 1);
      if (!firstSeen.has(vid)) firstSeen.set(vid, e.created_at);
      lastSeen.set(vid, e.created_at);

      const isNew = e.user_id ? isNewClient.has(e.user_id) : false;
      if (!e.user_id) visitorsGuests.add(vid);
      else if (isNew) { visitorsNew.add(vid); visitorsClients.add(vid); }
      else visitorsClients.add(vid);

      if (e.event_type === "screen") {
        bump(screensAll, e.label || e.path || "/");
      } else {
        if (!e.user_id) bump(clicksGuests, e.label);
        else if (isNew) bump(clicksNew, e.label);
        else bump(clicksClients, e.label);
      }
      if (e.user_id) bump(perClient, e.user_id);
    }

    const fmtTop = (m: Map<string, number>, n = 8) =>
      top(m, n).map(([l, c], i) => `${i + 1}. ${esc(String(l))} — ${c}`).join("\n") || "—";

    const durMin = (vid: string) => {
      const a = new Date(firstSeen.get(vid)!).getTime();
      const b = new Date(lastSeen.get(vid)!).getTime();
      return Math.max(1, Math.round((b - a) / 60000));
    };

    const clientLines = top(perClient, 10).map(([uid, c]) => {
      const tag = isNewClient.has(uid) ? " 🆕" : "";
      return `• ${esc(nameOf.get(uid) || "Клиент")}${tag} — ${c} действий, ~${durMin(uid)} мин`;
    });

    const dateLabel = new Intl.DateTimeFormat("ru-RU", {
      timeZone: TZ, weekday: "short", day: "numeric", month: "long",
    }).format(new Date(`${day}T12:00:00+03:00`));

    const deviceLine = top(devices, 3)
      .map(([d, c]) => `${d}: ${Math.round((c / Math.max(1, events.length)) * 100)}%`)
      .join(" • ");

    let text: string;
    if (events.length === 0) {
      text = `📈 <b>Активность в приложении — ${esc(dateLabel)}</b>\n\nЗа день не зафиксировано ни одного действия.`;
    } else {
      text =
        `📈 <b>Активность в приложении — ${esc(dateLabel)}</b>\n\n` +
        `👥 Уникальных: <b>${visitorsAll.size}</b> ` +
        `(клиенты: ${visitorsClients.size}, из них новые: ${visitorsNew.size}; гости: ${visitorsGuests.size})\n` +
        `👆 Действий всего: <b>${events.length}</b>${deviceLine ? `\n📱 ${esc(deviceLine)}` : ""}\n\n` +
        `<b>Куда заходят (экраны)</b>\n${fmtTop(screensAll)}\n\n` +
        `<b>Что нажимают действующие клиенты</b>\n${fmtTop(clicksClients)}\n\n` +
        `<b>Что нажимают новые клиенты (до 7 дней)</b>\n${fmtTop(clicksNew, 6)}\n\n` +
        `<b>Что нажимают гости (без входа)</b>\n${fmtTop(clicksGuests, 6)}` +
        (clientLines.length ? `\n\n<b>Самые активные</b>\n${clientLines.join("\n")}` : "");
    }

    if (dryRun) {
      return new Response(JSON.stringify({ ok: true, dry_run: true, text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chat = Deno.env.get("TELEGRAM_CHAT_ID");
    if (token && chat) {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true }),
      });
      if (!res.ok) console.error("telegram error:", await res.text());
    }

    return new Response(JSON.stringify({ ok: true, events: events.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("usage-digest failed:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
