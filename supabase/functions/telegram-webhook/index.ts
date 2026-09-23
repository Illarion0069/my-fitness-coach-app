import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { reportSecurityEvent } from "../_shared/securityAlert.ts";
import { notifyClient, trainerChatId } from "../_shared/directChat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");

    // Setup: register webhook with Telegram (requires CRON_SECRET to call)
    if (url.searchParams.get("setup") === "true" || (body as any).setup === true) {
      const cronSecret = Deno.env.get('CRON_SECRET');
      if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
      const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram-webhook`;
      const res = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: webhookUrl,
            secret_token: WEBHOOK_SECRET,
            allowed_updates: ["message", "edited_message"],
          }),
        }
      );
      const data = await res.json();
      console.log("Webhook setup result:", JSON.stringify(data));
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate Telegram secret token for incoming updates
    if (!WEBHOOK_SECRET || req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== WEBHOOK_SECRET) {
      console.warn("Telegram webhook: invalid or missing secret token");
      await reportSecurityEvent(req, {
        kind: "forged_webhook",
        severity: "attack",
        detail: "Пришёл поддельный запрос к Telegram-вебхуку с неверным секретом — кто-то пытается управлять ботом со стороны.",
      });
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    console.log("Telegram webhook received:", JSON.stringify(body));

    const message = (body as any).message;
    if (!message) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatId = String(message.chat.id);
    const text = message.text || "";
    const firstName = message.from?.first_name || "";
    const lastName = message.from?.last_name || "";
    const fullName = `${firstName} ${lastName}`.trim();

    // Trainer replies (Reply) to a chat notification → deliver into the in-app chat
    const replyToId = message.reply_to_message?.message_id;
    if (replyToId && text && !text.startsWith("/")) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: orig } = await supabase
        .from("direct_messages")
        .select("client_user_id, trainer_user_id, is_guest")
        .eq("trainer_tg_message_id", replyToId)
        .maybeSingle();
      if (orig) {
        const expected = await trainerChatId(supabase, orig.trainer_user_id);
        if (expected && expected === chatId) {
          const bodyText = text.slice(0, 2000);
          const { error } = await supabase.from("direct_messages").insert({
            client_user_id: orig.client_user_id,
            trainer_user_id: orig.trainer_user_id,
            sender_user_id: orig.trainer_user_id,
            body: bodyText,
            is_guest: orig.is_guest,
          });
          const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
          if (error) {
            console.error("reply insert failed", error);
            await sendTelegramMessage(TOKEN, chatId, "⚠️ Не удалось отправить ответ в чат. Попробуйте ещё раз.");
          } else {
            await notifyClient(supabase, orig.client_user_id, orig.is_guest, bodyText);
            await sendTelegramMessage(TOKEN, chatId, "✅ Ответ отправлен в чат приложения");
          }
          return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }


    // Handle /start command — link telegram chat_id to profile
    if (text.startsWith("/start")) {
      const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Check if already linked
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("telegram_chat_id", chatId)
        .maybeSingle();

      if (existingProfile) {
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId,
          `✅ ${existingProfile.full_name}, вы уже подключены к уведомлениям Limassol Fitness! 💪`);
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract deep link code: "/start abc123def456"
      const parts = text.split(" ");
      const linkCode = parts.length > 1 ? parts[1].trim() : null;

      let matched = false;

      // Priority 1: Deep link code match (100% reliable)
      if (linkCode) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("telegram_link_code", linkCode)
          .is("telegram_chat_id", null)
          .maybeSingle();

        if (profile) {
          await supabase
            .from("profiles")
            .update({ telegram_chat_id: chatId })
            .eq("id", profile.id);
          matched = true;

          await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId,
            `✅ Привет, ${profile.full_name}! Вы успешно подключены к уведомлениям Limassol Fitness. 💪`);

          const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
          if (TELEGRAM_CHAT_ID) {
            await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
              `🔗 Клиент <b>${profile.full_name}</b> подключился к Telegram через deep link!`);
          }
        }
      }

      // Name matching fallback removed for security — only deep link codes are used

      if (!matched) {
        const noCodeMsg = !linkCode
          ? `👋 Привет, ${fullName}! Чтобы подключить уведомления, нажмите кнопку «Telegram Bot» в разделе Контакты приложения Limassol Fitness:\nhttps://my-fitness-coach-app.lovable.app\n\nЭто создаст персональную ссылку для привязки вашего аккаунта.`
          : `👋 Привет, ${fullName}! Не удалось привязать аккаунт автоматически. Попробуйте ещё раз через кнопку «Telegram Bot» в приложении или обратитесь к тренеру.`;
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, noCodeMsg);

        const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
        if (TELEGRAM_CHAT_ID) {
          await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
            `⚠️ Новый /start от <b>${fullName}</b> (chat_id: ${chatId}), не удалось привязать автоматически.`);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendTelegramMessage(token: string, chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  return await res.json();
}
