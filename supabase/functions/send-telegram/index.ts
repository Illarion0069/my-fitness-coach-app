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
    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const roleClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse body early to check action
    const body = await req.json();
    const { message, action, telegram_username, booking_id, session_id, client_user_id } = body;

    // Allow registration notifications from any authenticated user
    const isRegistrationNotify = action === "notifyRegistration";
    const isCancelNotify = action === "cancelSession";

    if (!isRegistrationNotify && !isCancelNotify) {
      // Check caller has trainer role
      const { data: roleData } = await roleClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "trainer")
        .maybeSingle();

      if (!roleData) {
        return new Response(JSON.stringify({ error: "Forbidden: trainer role required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Input validation (body already parsed above)

    // Input validation
    if (message && (typeof message !== "string" || message.length > 4096)) {
      return new Response(JSON.stringify({ error: "Invalid message (max 4096 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (session_id && !uuidRegex.test(session_id)) {
      return new Response(JSON.stringify({ error: "Invalid session_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (booking_id && !uuidRegex.test(booking_id)) {
      return new Response(JSON.stringify({ error: "Invalid booking_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (client_user_id && !uuidRegex.test(client_user_id)) {
      return new Response(JSON.stringify({ error: "Invalid client_user_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not configured");

    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!TELEGRAM_CHAT_ID) throw new Error("TELEGRAM_CHAT_ID not configured");

    // Debug action: get bot info
    if (action === "getMe") {
      const meRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`);
      const meData = await meRes.json();
      return new Response(JSON.stringify(meData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send confirmation to client via Telegram (best-effort: bot can only message users who started /start)
    if (action === "sendToClient" && telegram_username) {
      // We can't send by username directly — bot needs chat_id.
      // For now, send the message to trainer with a note to forward to client.
      // In future: implement webhook to capture chat_ids from /start commands.
      const trainerMsg = `📨 <b>Forward to client @${telegram_username}:</b>\n\n${message}`;
      await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, trainerMsg);
      
      return new Response(JSON.stringify({ success: true, note: "Message sent to trainer for forwarding" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notify all participants when group is full
    if (action === "notifyGroupFull" && session_id) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: session } = await supabase
        .from("group_sessions")
        .select("*")
        .eq("id", session_id)
        .single();

      const { data: sessionBookings } = await supabase
        .from("group_bookings")
        .select("*")
        .eq("session_id", session_id);

      if (session && sessionBookings) {
        const date = new Date(session.session_date + "T00:00:00");
        const dateStr = date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
        const time = session.start_time.slice(0, 5);
        const location = session.location || "Eleftherias 119, Limassol";

        // Notify trainer
        const participantList = sessionBookings.map((b: any, i: number) => 
          `${i + 1}. ${b.participant_name} (📱${b.participant_phone})`
        ).join("\n");

        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
          `🎉 <b>GROUP CLASS CONFIRMED!</b>\n\n📅 ${dateStr} at ${time}\n📍 ${location}\n\n<b>Participants:</b>\n${participantList}\n\n✅ All ${session.max_participants} spots filled!`
        );

        // Notify clients who provided Telegram (forward via trainer)
        for (const booking of sessionBookings) {
          if ((booking as any).participant_telegram) {
            await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
              `📨 <b>Forward to @${(booking as any).participant_telegram}:</b>\n\n🎉 <b>Class Confirmed!</b>\n\n📅 ${dateStr} at ${time}\n📍 ${location}\n\n✅ All ${session.max_participants} spots are filled. The training is happening!\nSee you there! 💪`
            );
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send reminder directly to client if they have telegram_chat_id
    if (action === "sendReminder" && client_user_id) {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);

      const { data: clientProfile } = await adminClient
        .from("profiles")
        .select("telegram_chat_id, full_name")
        .eq("user_id", client_user_id)
        .single();

      if (clientProfile?.telegram_chat_id) {
        // Send to client directly
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, clientProfile.telegram_chat_id, message);
        // Also notify trainer
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `✅ Напоминание отправлено клиенту <b>${clientProfile.full_name}</b> в Telegram.`);
        return new Response(JSON.stringify({ success: true, sent_to: "client" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        // No telegram linked — send to trainer with note
        await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, `⚠️ У клиента <b>${clientProfile?.full_name || 'Unknown'}</b> не привязан Telegram.\n\n${message}`);
        return new Response(JSON.stringify({ success: true, sent_to: "trainer_only", reason: "no_telegram" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Client cancels a session — notify trainer
    if (isCancelNotify) {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: profile } = await adminClient
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      const clientName = profile?.full_name || "Unknown";
      const cancelMsg = `❌ <b>Клиент отменил тренировку</b>\n\n👤 ${clientName}\n📅 ${message}`;
      await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, cancelMsg);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: send message to trainer
    await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, message);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending Telegram message:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Telegram API error [${res.status}]: ${JSON.stringify(data)}`);
  }
  return data;
}
