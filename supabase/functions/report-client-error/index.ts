import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Simple in-memory dedup so one broken screen doesn't flood the chat
const recent = new Map<string, number>();
const DEDUP_MS = 5 * 60 * 1000;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
    const stack = String(body?.stack || "").slice(0, 900);
    const userId = String(body?.user_id || "").slice(0, 64);
    const userName = String(body?.user_name || "").slice(0, 80);
    const userAgent = String(body?.user_agent || "").slice(0, 200);

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

    const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const TG_CHAT = Deno.env.get("TELEGRAM_CHAT_ID");
    if (TG_TOKEN && TG_CHAT) {
      const text =
        `🐞 <b>Ошибка в приложении у клиента</b>\n\n` +
        `👤 ${esc(userName || "гость")}${userId ? ` (<code>${esc(userId)}</code>)` : ""}\n` +
        `📍 ${esc(source)}\n` +
        (url ? `🔗 ${esc(url)}\n` : "") +
        `\n❌ ${esc(message)}` +
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

    return new Response(JSON.stringify({ ok: true }), {
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
