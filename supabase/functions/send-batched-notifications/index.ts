import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_DELAY_SECONDS = 60;

const escapeHtml = (s: string): string =>
  s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : s;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }


  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not configured");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!TELEGRAM_CHAT_ID) throw new Error("TELEGRAM_CHAT_ID not configured");

    // Get all unsent notifications
    const { data: pending, error } = await supabase
      .from("pending_notifications")
      .select("*")
      .eq("is_sent", false)
      .order("created_at", { ascending: true });

    if (error) throw error;
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ message: "No pending notifications" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by client_user_id
    const grouped: Record<string, typeof pending> = {};
    for (const n of pending) {
      if (!grouped[n.client_user_id]) grouped[n.client_user_id] = [];
      grouped[n.client_user_id].push(n);
    }

    const now = new Date();
    const sentIds: string[] = [];
    let sentCount = 0;

    for (const [clientId, notifications] of Object.entries(grouped)) {
      // Check if last notification is older than BATCH_DELAY_SECONDS
      const lastCreated = new Date(notifications[notifications.length - 1].created_at);
      const secondsSinceLast = (now.getTime() - lastCreated.getTime()) / 1000;

      if (secondsSinceLast < BATCH_DELAY_SECONDS) {
        // Trainer might still be making changes, skip this client
        continue;
      }

      // Build consolidated message
      const lines = notifications.map((n) => n.details);
      const consolidatedMessage = `📋 <b>Обновление расписания</b>\n\n${lines.join("\n\n")}`;

      // Get client's telegram_chat_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("telegram_chat_id, full_name")
        .eq("user_id", clientId)
        .single();

      // Send to client
      if (profile?.telegram_chat_id) {
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, profile.telegram_chat_id, consolidatedMessage);
      }

      // Also send summary to trainer
      const clientName = escapeHtml(profile?.full_name || "Клиент");
      const trainerSummary = `📋 <b>Изменения отправлены клиенту ${clientName}</b>\n\n${lines.join("\n\n")}`;
      await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, trainerSummary);

      sentIds.push(...notifications.map((n) => n.id));
      sentCount++;
    }

    // Mark as sent
    if (sentIds.length > 0) {
      await supabase
        .from("pending_notifications")
        .update({ is_sent: true })
        .in("id", sentIds);
    }

    return new Response(
      JSON.stringify({ success: true, clients_notified: sentCount, messages_processed: sentIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in batched notifications:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function sendTelegramMessage(token: string, chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`Telegram API error [${res.status}]:`, data);
  }
  return data;
}
