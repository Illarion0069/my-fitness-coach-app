import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { reportSecurityEvent, looksMalicious } from "../_shared/securityAlert.ts";

// Simple in-memory dedup so one broken screen doesn't flood the chat
const recent = new Map<string, number>();
const DEDUP_MS = 5 * 60 * 1000;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Сетевой шум — никогда не считается критичным и не шлётся в чат
const NETWORK_NOISE = [
  "failed to fetch",
  "load failed",
  "networkerror",
  "network request failed",
  "the operation was aborted",
  "signal is aborted",
  "aborterror",
  "the network connection was lost",
  "importing a module script failed",
  "failed to fetch dynamically imported module",
  "resizeobserver loop",
  "cancelled",
  "отменено",
];

type Verdict = {
  level: "ignore" | "warning" | "critical";
  reason: string; // понятными словами: что произошло
  fix: string; // что делать
};

function classify(message: string, source: string, online: boolean, userVisible: boolean): Verdict {
  const m = message.toLowerCase();

  // Боты/старые вкладки: несуществующие маршруты и протухшие файлы сборки
  if (
    m.includes("404 error: user attempted to access non-existent route") ||
    m.includes("не загрузился ресурс") ||
    source === "resource-error"
  ) {
    return {
      level: "ignore",
      reason: "Заход на несуществующую страницу или старый файл сборки у закешированной вкладки (обычно поисковый бот).",
      fix: "Ничего делать не нужно.",
    };
  }


  if (!online || NETWORK_NOISE.some((n) => m.includes(n))) {
    if (userVisible) {
      return {
        level: "warning",
        reason: "У клиента оборвалась связь (заблокировал телефон, ушёл в фон, слабый интернет) — и он увидел красное окно с ошибкой.",
        fix: "Данные не потеряны. Если повторяется часто — не показывать окно, а тихо повторять запрос при возвращении в приложение.",
      };
    }
    return {
      level: "ignore",
      reason: "Обрыв сети у посетителя (закрыл вкладку, потерял связь, блокировщик).",
      fix: "Ничего делать не нужно — это не баг приложения.",
    };
  }


  if (m.includes("chunkloaderror") || m.includes("dynamically imported module")) {
    return {
      level: "warning",
      reason: "У человека открыта старая версия приложения после нашего обновления.",
      fix: "Попросить перезагрузить страницу. Повторяется часто — добавить авто-обновление при новой сборке.",
    };
  }

  if (m.includes("jwt") || m.includes("401") || m.includes("not authenticated") || m.includes("invalid refresh token")) {
    return {
      level: "warning",
      reason: "Сессия входа истекла или недействительна.",
      fix: "Клиенту — выйти и войти заново. Если массово — проверить обновление токенов в авторизации.",
    };
  }

  if (m.includes("row-level security") || m.includes("permission denied") || m.includes("403")) {
    return {
      level: "critical",
      reason: "Приложение не имеет прав на чтение/запись данных — не хватает политики доступа в базе.",
      fix: "Проверить RLS-политики и права для таблицы из стека ошибки.",
    };
  }

  if (m.includes("is not a function") || m.includes("undefined is not an object") ||
      m.includes("cannot read properties") || m.includes("is not defined")) {
    return {
      level: "critical",
      reason: "Сломался код экрана: ожидались данные, а их не оказалось — экран мог не отрисоваться.",
      fix: "Открыть файл из стека, добавить защиту от пустых данных и проверить загрузку экрана.",
    };
  }

  if (source === "react-error-boundary") {
    return {
      level: "critical",
      reason: "Экран упал целиком — пользователь увидел заглушку с ошибкой.",
      fix: "Воспроизвести маршрут из ссылки и починить компонент из стека.",
    };
  }

  return {
    level: "warning",
    reason: "Неожиданная ошибка в приложении, требует ручной проверки.",
    fix: "Открыть указанную страницу и повторить действия пользователя.",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const message = String(body?.message || "").slice(0, 500);
    if (!message) {
      return new Response(JSON.stringify({ error: "message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const source = String(body?.source || "unknown").slice(0, 60);
    const url = String(body?.url || "").slice(0, 200);
    const route = String(body?.route || "").slice(0, 100);
    const stack = String(body?.stack || "").slice(0, 900);
    const userId = String(body?.user_id || "").slice(0, 64);
    const userName = String(body?.user_name || "").slice(0, 80);
    const userAgent = String(body?.user_agent || "").slice(0, 200);
    const online = body?.online !== false;
    const userVisible = body?.user_visible === true;
    const occurredAt = String(body?.occurred_at || new Date().toISOString());
    const release = String(body?.release || "").slice(0, 60);
    const breadcrumbs = String(body?.breadcrumbs || "").slice(0, 1500);
    const viewport = String(body?.viewport || "").slice(0, 20);

    // Признаки атаки в самом тексте ошибки / адресе страницы — отдельный алерт по безопасности
    if (looksMalicious(message) || looksMalicious(url) || looksMalicious(route)) {
      await reportSecurityEvent(req, {
        kind: "injection_attempt",
        severity: "attack",
        detail: "В адресе страницы или данных запроса найден вредоносный код — кто-то пробует внедрить скрипт или SQL.",
        userId: userId || null,
        userName: userName || null,
        route: route || url,
        meta: { message, source },
      });
    } else if (message.toLowerCase().includes("row-level security") && !userId) {
      await reportSecurityEvent(req, {
        kind: "rls_probe",
        severity: "suspicious",
        detail: "Незалогиненный посетитель пытался прочитать закрытые данные — база отказала в доступе.",
        route: route || url,
        meta: { message, source },
      });
    }

    const verdict = classify(message, source, online, userVisible);

    if (verdict.level === "ignore") {
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: verdict.reason }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Журнал ошибок: пишем каждое событие, даже если алерт в Telegram задедуплен
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
      const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (SUPABASE_URL && SERVICE_KEY) {
        const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
          auth: { persistSession: false },
        });
        await admin.from("client_errors").insert({
          fingerprint: `${source}|${message.replace(/\d+/g, "#").slice(0, 200)}`,
          message,
          stack: stack || null,
          source,
          level: verdict.level,
          route: route || null,
          url: url || null,
          release: release || null,
          viewport: viewport || null,
          breadcrumbs: breadcrumbs || null,
          user_id: userId || null,
          user_name: userName || null,
          user_agent: userAgent || null,
          online,
          user_visible: userVisible,
          occurred_at: occurredAt,
        });
      }
    } catch (e) {
      console.error("client_errors insert failed:", e);
    }

    const key = `${source}|${message}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < DEDUP_MS) {
      return new Response(JSON.stringify({ ok: true, deduped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    recent.set(key, now);
    for (const [k, t] of recent) if (now - t > DEDUP_MS) recent.delete(k);

    const when = new Date(occurredAt).toLocaleString("ru-RU", {
      timeZone: "Asia/Nicosia",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const who = userId
      ? `${userName || "клиент"} (<code>${esc(userId)}</code>)`
      : "гость — не залогинен, личность неизвестна";

    const title = verdict.level === "critical"
      ? "🚨 <b>Критичная ошибка в приложении</b>"
      : "⚠️ <b>Предупреждение в приложении</b>";

    const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const TG_CHAT = Deno.env.get("TELEGRAM_CHAT_ID");
    if (TG_TOKEN && TG_CHAT) {
      const text =
        `${title}\n\n` +
        `👤 Кто: ${who}\n` +
        `🕐 Когда: ${esc(when)} (Кипр)\n` +
        `📄 Где: ${esc(route || url || "неизвестно")}\n` +
        (userAgent ? `📱 Устройство: ${esc(userAgent)}${viewport ? ` · ${esc(viewport)}` : ""}\n` : "") +
        (release ? `🏷 Версия: ${esc(release)}\n` : "") +
        `\n💬 Почему: ${esc(verdict.reason)}\n` +
        `🛠 Что делать: ${esc(verdict.fix)}\n` +
        `\n❌ Техтекст: ${esc(message)} (${esc(source)})` +
        (breadcrumbs ? `\n\n👣 Что делал перед ошибкой:\n<pre>${esc(breadcrumbs.slice(0, 700))}</pre>` : "") +
        (stack ? `\n\n<pre>${esc(stack)}</pre>` : "");

      const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TG_CHAT,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
      if (!res.ok) console.error("telegram error:", await res.text());
    }

    return new Response(JSON.stringify({ ok: true, level: verdict.level }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("report-client-error failed:", e);
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
