import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function tg(chatId: string | null | undefined, text: string) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token || !chatId) return;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!r.ok) console.error("TG send failed", r.status, await r.text());
  } catch (e) {
    console.error("TG send error", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!text || text.length > 2000) return json({ error: "Message must be 1–2000 characters" }, 400);

    const { data: isTrainerRow } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "trainer").maybeSingle();
    const isTrainer = !!isTrainerRow;

    let clientId: string;
    let trainerId: string;
    if (isTrainer && body.client_user_id) {
      if (!uuidRe.test(body.client_user_id)) return json({ error: "Invalid client" }, 400);
      const { data: cp } = await admin
        .from("profiles").select("user_id, trainer_user_id").eq("user_id", body.client_user_id).maybeSingle();
      if (!cp) return json({ error: "Client not found" }, 404);
      if (cp.trainer_user_id && cp.trainer_user_id !== user.id) return json({ error: "Forbidden" }, 403);
      clientId = cp.user_id;
      trainerId = user.id;
    } else {
      const { data: me } = await admin
        .from("profiles").select("trainer_user_id").eq("user_id", user.id).maybeSingle();
      let t = me?.trainer_user_id as string | null;
      if (!t) {
        const { data: tr } = await admin.from("user_roles").select("user_id").eq("role", "trainer").limit(1).maybeSingle();
        t = tr?.user_id ?? null;
      }
      if (!t) return json({ error: "Trainer not found" }, 404);
      clientId = user.id;
      trainerId = t;
    }

    // Simple flood guard: max 30 messages per sender per 10 minutes
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await admin.from("direct_messages").select("id", { count: "exact", head: true })
      .eq("sender_user_id", user.id).gte("created_at", since);
    if ((count ?? 0) >= 30) return json({ error: "Too many messages, try again later" }, 429);

    const { data: msg, error } = await admin.from("direct_messages").insert({
      client_user_id: clientId, trainer_user_id: trainerId, sender_user_id: user.id, body: text,
    }).select().single();
    if (error) {
      console.error("insert failed", error);
      return json({ error: "Could not save message" }, 500);
    }

    const { data: clientProfile } = await admin
      .from("profiles").select("full_name, telegram_chat_id, preferred_language").eq("user_id", clientId).maybeSingle();

    if (user.id === clientId) {
      const { data: trainerProfile } = await admin
        .from("profiles").select("telegram_chat_id").eq("user_id", trainerId).maybeSingle();
      const chat = trainerProfile?.telegram_chat_id || Deno.env.get("TELEGRAM_CHAT_ID");
      await tg(chat, `💬 <b>${esc(clientProfile?.full_name || "Клиент")}</b> написал(а):\n\n${esc(text)}\n\n<i>Ответить можно в приложении → Админ → Сообщения</i>`);
    } else {
      const en = clientProfile?.preferred_language === "en";
      await tg(clientProfile?.telegram_chat_id,
        en
          ? `💬 <b>New message from Illarion:</b>\n\n${esc(text)}\n\n<i>Reply in the app: limassol-fitness.com</i>`
          : `💬 <b>Новое сообщение от Иллариона:</b>\n\n${esc(text)}\n\n<i>Ответить можно в приложении: limassol-fitness.com</i>`);
    }

    return json({ message: msg });
  } catch (e) {
    console.error(e);
    return json({ error: "Internal error" }, 500);
  }
});
