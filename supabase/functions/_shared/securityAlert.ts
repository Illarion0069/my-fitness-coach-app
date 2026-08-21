// Centralised security-incident reporting.
// Logs the event to public.security_events and pings Telegram for real threats.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type SecuritySeverity = "info" | "suspicious" | "attack";

export type SecurityEventInput = {
  kind: string; // machine key, e.g. "privilege_escalation"
  severity: SecuritySeverity;
  /** Plain-language description for the Telegram alert */
  detail: string;
  userId?: string | null;
  userName?: string | null;
  route?: string | null;
  meta?: Record<string, unknown>;
};

const RU_KIND: Record<string, string> = {
  privilege_escalation: "Попытка выполнить действие тренера без прав",
  forged_webhook: "Поддельный запрос к вебхуку (неверный секрет)",
  brute_force_reset: "Перебор кодов восстановления пароля",
  invalid_mcp_token: "Попытка входа в интеграцию с неверным токеном",
  injection_attempt: "Похоже на попытку внедрения кода (SQL/XSS)",
  rls_probe: "Попытка достать чужие данные из базы",
};

// per-isolate throttle so one attacker can't flood the chat
const recent = new Map<string, number>();
const THROTTLE_MS = 5 * 60 * 1000;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}

/** Obvious attack payloads in free-text user input */
export function looksMalicious(value: string): boolean {
  const v = value.toLowerCase();
  const patterns = [
    "<script",
    "javascript:",
    "onerror=",
    "onload=",
    "union select",
    "select * from",
    "drop table",
    "insert into",
    "delete from",
    "pg_sleep",
    "information_schema",
    "service_role",
    "../../",
    "/etc/passwd",
    "${jndi:",
  ];
  return patterns.some((p) => v.includes(p));
}

export async function reportSecurityEvent(
  req: Request,
  input: SecurityEventInput,
): Promise<void> {
  try {
    const ip = clientIp(req);
    const userAgent = (req.headers.get("user-agent") || "").slice(0, 200);
    const route = input.route || new URL(req.url).pathname;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey);
      await admin.from("security_events").insert({
        kind: input.kind,
        severity: input.severity,
        detail: input.detail.slice(0, 500),
        user_id: input.userId || null,
        user_name: (input.userName || "").slice(0, 80) || null,
        ip,
        user_agent: userAgent,
        route: route.slice(0, 120),
        meta: input.meta || {},
      });
    }

    if (input.severity === "info") return;

    const key = `${input.kind}|${ip}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < THROTTLE_MS) return;
    recent.set(key, now);
    for (const [k, t] of recent) if (now - t > THROTTLE_MS) recent.delete(k);

    const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const TG_CHAT = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!TG_TOKEN || !TG_CHAT) return;

    const when = new Date().toLocaleString("ru-RU", {
      timeZone: "Asia/Nicosia",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const title =
      input.severity === "attack"
        ? "🛡️ <b>Похоже на атаку на приложение</b>"
        : "🔍 <b>Подозрительная активность</b>";

    const text =
      `${title}\n\n` +
      `⚠️ Что: ${esc(RU_KIND[input.kind] || input.kind)}\n` +
      `💬 Детали: ${esc(input.detail)}\n` +
      `🕐 Когда: ${esc(when)} (Кипр)\n` +
      `📄 Куда стучались: ${esc(route)}\n` +
      `🌐 IP: <code>${esc(ip)}</code>\n` +
      (input.userId
        ? `👤 Аккаунт: ${esc(input.userName || "клиент")} (<code>${esc(input.userId)}</code>)\n`
        : "👤 Аккаунт: не залогинен\n") +
      (userAgent ? `📱 Устройство: ${esc(userAgent)}\n` : "") +
      `\n🛠 Доступ заблокирован автоматически — данные не пострадали. Если повторяется, стоит забанить IP.`;

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
    if (!res.ok) console.error("security alert telegram error:", await res.text());
  } catch (e) {
    console.error("reportSecurityEvent failed:", e);
  }
}
