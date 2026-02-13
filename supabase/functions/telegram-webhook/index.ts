import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    
    // Setup: register webhook with Telegram
    if (url.searchParams.get("setup") === "true") {
      const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
      const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram-webhook`;
      const res = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: webhookUrl }),
        }
      );
      const data = await res.json();
      console.log("Webhook setup result:", JSON.stringify(data));
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    console.log("Telegram webhook received:", JSON.stringify(body));

    const message = body.message;
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

    // Handle /start command — link telegram chat_id to profile
    if (text.startsWith("/start")) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Try to find profile by full_name match (best effort)
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, telegram_chat_id")
        .is("telegram_chat_id", null);

      let matched = false;
      if (profiles && profiles.length > 0) {
        // Try exact match first, then fuzzy
        const exactMatch = profiles.find(
          (p: any) => p.full_name.toLowerCase() === fullName.toLowerCase()
        );
        const fuzzyMatch = profiles.find(
          (p: any) =>
            p.full_name.toLowerCase().includes(firstName.toLowerCase()) ||
            firstName.toLowerCase().includes(p.full_name.split(" ")[0]?.toLowerCase())
        );

        const matchedProfile = exactMatch || fuzzyMatch;
        if (matchedProfile) {
          await supabase
            .from("profiles")
            .update({ telegram_chat_id: chatId })
            .eq("id", matchedProfile.id);
          matched = true;

          // Send confirmation to client
          const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
          await sendTelegramMessage(
            TELEGRAM_BOT_TOKEN,
            chatId,
            `✅ Привет, ${matchedProfile.full_name}! Вы подключены к уведомлениям Limassol Fitness. Теперь вы будете получать напоминания здесь. 💪`
          );

          // Notify trainer
          const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
          if (TELEGRAM_CHAT_ID) {
            await sendTelegramMessage(
              TELEGRAM_BOT_TOKEN,
              TELEGRAM_CHAT_ID,
              `🔗 Клиент <b>${matchedProfile.full_name}</b> подключился к Telegram-уведомлениям!`
            );
          }
        }
      }

      if (!matched) {
        // No match found — save chat_id anyway and notify trainer
        const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
        await sendTelegramMessage(
          TELEGRAM_BOT_TOKEN,
          chatId,
          `👋 Привет, ${fullName}! Я бот Limassol Fitness. Ваш аккаунт будет привязан вручную тренером.`
        );

        const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
        if (TELEGRAM_CHAT_ID) {
          await sendTelegramMessage(
            TELEGRAM_BOT_TOKEN,
            TELEGRAM_CHAT_ID,
            `⚠️ Новый /start от <b>${fullName}</b> (chat_id: ${chatId}), но автоматически не удалось привязать к профилю. Привяжите вручную.`
          );
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
