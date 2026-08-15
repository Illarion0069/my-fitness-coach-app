import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const esc = (s: string) =>
  (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const TZ = "Asia/Nicosia";

// Разрыв активности, после которого считаем новую сессию
const SESSION_GAP_MS = 15 * 60 * 1000;
// Сколько «весит» одиночное событие в сессии
const TAIL_MS = 30 * 1000;

function cyprusDate(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function hm(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function top<T>(counts: Map<T, number>, n: number): [T, number][] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function bump<T>(m: Map<T, number>, k: T, by = 1) {
  m.set(k, (m.get(k) || 0) + by);
}

// --- Человекочитаемые названия экранов вместо технических путей ---
const SCREEN_NAMES: Record<string, string> = {
  "/": "Главная",
  "/index": "Главная",
  "/#pricing": "Главная → Цены",
  "/#about": "Главная → Обо мне",
  "/#workouts": "Главная → Тренировки",
  "/#contact": "Главная → Контакты",
  "/#booking": "Главная → Запись",
  "/#hero": "Главная (верх)",
  "/#faq": "Главная → Вопросы",
  "/pricing": "Цены",
  "/booking": "Запись на тренировку",
  "/booking-en": "Запись на тренировку (EN)",
  "/ru": "Главная (RU)",
  "/en": "Главная (EN)",
  "/dashboard": "Кабинет клиента",
  "/nutrition": "Дневник питания",
  "/settings": "Настройки клиента",
  "/admin": "Админ-панель",
  "/auth": "Вход / Регистрация",
};

function prettyScreen(raw: string): string {
  const s = (raw || "/").trim();
  const key = s.toLowerCase().replace(/\/+$/, "") || "/";
  if (SCREEN_NAMES[key]) return SCREEN_NAMES[key];

  // «/#pricing» уже покрыт; отдельно разбираем хеш-якорь на любой странице
  const [pathPart, hashPart] = key.split("#");
  const base = SCREEN_NAMES[pathPart.replace(/\/+$/, "") || "/"];
  if (hashPart) {
    const anchor = SCREEN_NAMES[`/#${hashPart}`];
    if (anchor) return anchor;
    return `${base || pathPart} → ${hashPart}`;
  }

  if (/^\/client-\d+/.test(key)) return `Несуществующая страница (${s})`;
  if (base) return base;
  // Неизвестный путь: делаем читабельным
  const words = key.replace(/^\//, "").replace(/[-_/]+/g, " ").trim();
  return words ? `Страница «${words}»` : "Главная";
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

    const [eventsRes, profilesRes, staffRes] = await Promise.all([
      supabase.from("app_events")
        .select("user_id, anon_id, event_type, label, path, device, created_at")
        .gte("created_at", dayStartUtc).lte("created_at", dayEndUtc)
        .order("created_at", { ascending: true })
        .limit(20000),
      supabase.from("profiles").select("user_id, full_name, created_at"),
      supabase.from("user_roles").select("user_id, role").in("role", ["trainer", "admin"]),
    ]);

    const rawEvents = eventsRes.data || [];
    const profiles = profilesRes.data || [];

    // --- Исключаем активность тренера/админа (в т.ч. его гостевые anon_id) ---
    const staffIds = new Set((staffRes.data || []).map((r: any) => r.user_id));
    const staffAnon = new Set<string>();
    for (const e of rawEvents) {
      if (e.user_id && staffIds.has(e.user_id) && e.anon_id) staffAnon.add(e.anon_id);
    }
    const events = rawEvents.filter(
      (e: any) => !(e.user_id && staffIds.has(e.user_id)) && !staffAnon.has(e.anon_id),
    );
    const excluded = rawEvents.length - events.length;

    const nameOf = new Map<string, string>();
    const isNewClient = new Set<string>();
    const signedUpToday = new Set<string>();
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    for (const p of profiles) {
      nameOf.set(p.user_id, p.full_name || "Клиент");
      const t = new Date(p.created_at).getTime();
      if (t >= weekAgo) isNewClient.add(p.user_id);
      if (t >= new Date(dayStartUtc).getTime() && t <= new Date(dayEndUtc).getTime()) {
        signedUpToday.add(p.user_id);
      }
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
    const funnelReach = new Map<string, Set<string>>();
    const timeline = new Map<string, any[]>(); // vid -> события (для новых/гостей)

    for (const e of events) {
      const vid = e.user_id || e.anon_id;
      visitorsAll.add(vid);
      bump(devices, e.device || "?");

      if (!timeline.has(vid)) timeline.set(vid, []);
      timeline.get(vid)!.push(e);

      const isNew = e.user_id ? isNewClient.has(e.user_id) : false;
      if (!e.user_id) visitorsGuests.add(vid);
      else if (isNew) { visitorsNew.add(vid); visitorsClients.add(vid); }
      else visitorsClients.add(vid);

      if (e.event_type === "screen") {
        bump(screensAll, prettyScreen(e.label || e.path || "/"));
      } else if (e.event_type === "funnel") {
        if (!funnelReach.has(e.label)) funnelReach.set(e.label, new Set());
        funnelReach.get(e.label)!.add(vid);
      } else {
        if (!e.user_id) bump(clicksGuests, e.label);
        else if (isNew) bump(clicksNew, e.label);
        else bump(clicksClients, e.label);
      }
      if (e.user_id) bump(perClient, e.user_id);
    }

    // --- Корректное время в приложении: сумма сессий с разрывом 15 мин ---
    function sessionStats(vid: string) {
      const list = timeline.get(vid) || [];
      let total = 0;
      let sessions = 0;
      let sStart = 0;
      let prev = 0;
      for (const e of list) {
        const t = new Date(e.created_at).getTime();
        if (!prev) { sStart = t; sessions = 1; }
        else if (t - prev > SESSION_GAP_MS) {
          total += Math.max(TAIL_MS, prev - sStart);
          sessions++;
          sStart = t;
        }
        prev = t;
      }
      if (prev) total += Math.max(TAIL_MS, prev - sStart);
      return { minutes: Math.max(1, Math.round(total / 60000)), sessions };
    }

    // --- Воронка: визит → запись ---
    const reach = (k: string) => funnelReach.get(k)?.size || 0;
    const funnelSteps: [string, number][] = [
      ["Зашли в приложение", visitorsAll.size],
      ["Открыли запись", reach("booking_open")],
      ["Выбрали дату", reach("booking_date")],
      ["Выбрали время", reach("booking_time")],
      ["Дошли до оплаты/данных", reach("booking_payment")],
      ["✅ Записались", reach("booking_done")],
    ];

    let worstDrop = { from: "", to: "", lost: 0, pct: 0 };
    const funnelLines = funnelSteps.map(([name, val], i) => {
      const base = funnelSteps[0][1] || 1;
      const prev = i > 0 ? funnelSteps[i - 1][1] : val;
      const conv = Math.round((val / base) * 100);
      let dropTxt = "";
      if (i > 0) {
        const lost = Math.max(0, prev - val);
        const pct = prev ? Math.round((lost / prev) * 100) : 0;
        dropTxt = lost ? `  (−${lost}, отвал ${pct}%)` : "  (без потерь)";
        if (lost > worstDrop.lost) {
          worstDrop = { from: funnelSteps[i - 1][0], to: name, lost, pct };
        }
      }
      return `${i + 1}. ${name}: <b>${val}</b> · ${conv}%${dropTxt}`;
    });

    const signupLines =
      `• Начали регистрацию: <b>${reach("signup_submit")}</b>\n` +
      `• Зарегистрировались: <b>${reach("signup_done")}</b>` +
      (reach("signup_submit") > reach("signup_done")
        ? `  (не дошли: ${reach("signup_submit") - reach("signup_done")})`
        : "");

    const bottleneck = worstDrop.lost
      ? `\n\n🔻 Основной отвал: <b>${esc(worstDrop.from)} → ${esc(worstDrop.to)}</b> — потеряли ${worstDrop.lost} чел. (${worstDrop.pct}%)`
      : "";

    const fmtTop = (m: Map<string, number>, n = 8) =>
      top(m, n).map(([l, c], i) => `${i + 1}. ${esc(String(l))} — ${c}`).join("\n") || "—";

    const clientLines = top(perClient, 10).map(([uid, c]) => {
      const st = sessionStats(uid);
      const tag = isNewClient.has(uid) ? " 🆕" : "";
      return `• ${esc(nameOf.get(uid) || "Клиент")}${tag} — ${c} действий, ~${st.minutes} мин (${st.sessions} захода)`;
    });

    // --- Детально: новые клиенты и гости, путь и причина отказа ---
    const FUNNEL_LABEL: Record<string, string> = {
      booking_open: "открыл запись",
      booking_date: "выбрал дату",
      booking_time: "выбрал время",
      booking_payment: "дошёл до оплаты",
      booking_done: "записался",
      signup_submit: "начал регистрацию",
      signup_done: "зарегистрировался",
    };
    const FUNNEL_ORDER = ["booking_open", "booking_date", "booking_time", "booking_payment", "booking_done"];

    const newcomerIds = [
      ...[...visitorsNew],
      ...[...visitorsGuests],
    ];

    const newcomerBlocks = newcomerIds
      .sort((a, b) => (timeline.get(b)?.length || 0) - (timeline.get(a)?.length || 0))
      .slice(0, 8)
      .map((vid) => {
        const list = timeline.get(vid) || [];
        const st = sessionStats(vid);
        const isUser = !!list[0]?.user_id;
        const who = isUser
          ? `${esc(nameOf.get(list[0].user_id) || "Клиент")}${signedUpToday.has(list[0].user_id) ? " 🆕 сегодня" : " 🆕"}`
          : `Гость ${esc(String(vid).slice(0, 6))}`;

        const screens = list.filter((e: any) => e.event_type === "screen")
          .map((e: any) => prettyScreen(e.label || e.path)).filter(Boolean);
        const uniqScreens: string[] = [];
        for (const s of screens) if (uniqScreens[uniqScreens.length - 1] !== s) uniqScreens.push(s);

        const clicks = list.filter((e: any) => e.event_type === "click").map((e: any) => e.label);
        const funnels = list.filter((e: any) => e.event_type === "funnel").map((e: any) => e.label);

        const lastStep = FUNNEL_ORDER.filter((f) => funnels.includes(f)).pop();
        const done = funnels.includes("booking_done");
        let verdict: string;
        if (done) verdict = "✅ записался";
        else if (!lastStep) verdict = "❌ не открывал запись — только смотрел";
        else {
          const idx = FUNNEL_ORDER.indexOf(lastStep);
          const next = FUNNEL_ORDER[idx + 1];
          verdict = `❌ остановился на «${FUNNEL_LABEL[lastStep]}»` +
            (next ? `, не дошёл до «${FUNNEL_LABEL[next]}»` : "");
        }

        return [
          `👤 <b>${who}</b> · ${hm(list[0].created_at)}–${hm(list[list.length - 1].created_at)} · ~${st.minutes} мин · ${esc(list[0].device || "?")}`,
          `   Путь: ${esc(uniqScreens.slice(0, 6).join(" → ") || "—")}`,
          `   Нажимал: ${esc(clicks.slice(0, 6).join(", ") || "—")}`,
          `   Итог: ${verdict}`,
        ].join("\n");
      });

    const dateLabel = new Intl.DateTimeFormat("ru-RU", {
      timeZone: TZ, weekday: "short", day: "numeric", month: "long",
    }).format(new Date(`${day}T12:00:00+03:00`));

    const deviceLine = top(devices, 3)
      .map(([d, c]) => `${d}: ${Math.round((c / Math.max(1, events.length)) * 100)}%`)
      .join(" • ");

    let text: string;
    if (events.length === 0) {
      text = `📈 <b>Активность в приложении — ${esc(dateLabel)}</b>\n\nЗа день не зафиксировано ни одного действия клиентов.`;
    } else {
      text =
        `📈 <b>Активность в приложении — ${esc(dateLabel)}</b>\n` +
        `<i>(без учёта вашей активности${excluded ? `, скрыто ${excluded} событий` : ""})</i>\n\n` +
        `👥 Уникальных: <b>${visitorsAll.size}</b> ` +
        `(клиенты: ${visitorsClients.size}, из них новые: ${visitorsNew.size}; гости: ${visitorsGuests.size})\n` +
        `👆 Действий всего: <b>${events.length}</b>${deviceLine ? `\n📱 ${esc(deviceLine)}` : ""}\n\n` +
        `<b>🚀 Воронка: визит → тренировка</b>\n${funnelLines.join("\n")}${bottleneck}\n\n` +
        `<b>Регистрация</b>\n${signupLines}\n\n` +
        (newcomerBlocks.length
          ? `<b>🆕 Новые и гости — детально</b>\n${newcomerBlocks.join("\n\n")}\n\n`
          : "") +
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
        body: JSON.stringify({ chat_id: chat, text: text.slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: true }),
      });
      if (!res.ok) console.error("telegram error:", await res.text());
    }

    return new Response(JSON.stringify({ ok: true, events: events.length, excluded }), {
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
