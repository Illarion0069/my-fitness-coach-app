// Shared helpers for trainer <-> client/guest direct chat
// deno-lint-ignore-file no-explicit-any

export const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Sends a Telegram message, returns its message_id (or null). */
export async function tgSend(chatId: string | null | undefined, text: string): Promise<number | null> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token || !chatId) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
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

/** Notify trainer about an incoming message and remember the TG message id so a Reply routes back. */
export async function notifyTrainer(admin: any, msg: { id: string; trainer_user_id: string; body: string }, who: string, isGuest: boolean) {
  const chat = await trainerChatId(admin, msg.trainer_user_id);
  const tag = isGuest ? "🆕 Новый посетитель" : "💬 Клиент";
  const mid = await tgSend(
    chat,
    `${tag} <b>${escHtml(who)}</b>:\n\n${escHtml(msg.body)}\n\n<i>↩️ Ответьте на это сообщение (Reply) — ответ уйдёт в чат приложения. Или ответьте в приложении → кнопка чата.</i>`,
  );
  if (mid) await admin.from("direct_messages").update({ trainer_tg_message_id: mid }).eq("id", msg.id);
}

/** Notify a registered client that the trainer replied. Guests see it in-app only. */
export async function notifyClient(admin: any, clientId: string, isGuest: boolean, text: string) {
  if (isGuest) return;
  const { data: p } = await admin
    .from("profiles").select("telegram_chat_id, preferred_language").eq("user_id", clientId).maybeSingle();
  const en = p?.preferred_language === "en";
  await tgSend(
    p?.telegram_chat_id,
    en
      ? `💬 <b>New message from Illarion:</b>\n\n${escHtml(text)}\n\n<i>Reply in the app: limassol-fitness.com</i>`
      : `💬 <b>Новое сообщение от Иллариона:</b>\n\n${escHtml(text)}\n\n<i>Ответить можно в приложении: limassol-fitness.com</i>`,
  );
}

export async function sha256(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
