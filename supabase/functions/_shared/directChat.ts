// Shared helpers for trainer <-> guest direct chat
// deno-lint-ignore-file no-explicit-any

export const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const APP_URL = "https://limassol-fitness.com";

/** Sends a Telegram message, returns its message_id (or null). */
export async function tgSend(chatId: string | null | undefined, text: string, extra: Record<string, unknown> = {}): Promise<number | null> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token || !chatId) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) {
      console.error("TG send failed", r.status, JSON.stringify(j));
      return null;
    }
    return j.result?.message_id ?? null;
  } catch (e) {
    console.error("TG send error", e);
    return null;
  }
}

export async function trainerChatId(admin: any, trainerId: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("telegram_chat_id").eq("user_id", trainerId).maybeSingle();
  return data?.telegram_chat_id || Deno.env.get("TELEGRAM_CHAT_ID") || null;
}

/** Notify trainer about an incoming guest message with a button that opens the chat in the app. */
export async function notifyTrainer(
  admin: any,
  msg: { id: string; trainer_user_id: string; client_user_id: string; body: string; attachment_name?: string | null },
  who: string,
  _isGuest = true,
) {
  const chat = await trainerChatId(admin, msg.trainer_user_id);
  const link = `${APP_URL}/?chat=${msg.client_user_id}`;
  const text = msg.body || (msg.attachment_name ? `📎 ${msg.attachment_name}` : "📎 Файл");
  const mid = await tgSend(
    chat,
    `🆕 Новый посетитель <b>${escHtml(who)}</b>:\n\n${escHtml(text)}`,
    { reply_markup: { inline_keyboard: [[{ text: "💬 Открыть чат", url: link }]] } },
  );
  if (mid) await admin.from("direct_messages").update({ trainer_tg_message_id: mid }).eq("id", msg.id);
}

/** Guests see replies in-app only. Kept for compatibility with the Telegram webhook. */
export async function notifyClient(_admin: any, _clientId: string, _isGuest: boolean, _text: string) {
  return;
}

export async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
