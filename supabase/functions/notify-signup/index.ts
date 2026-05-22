import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (s: string) =>
  (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Idempotent: only notify if not already notified
    const { data: profile } = await admin
      .from("profiles")
      .select("id, user_id, full_name, email, phone, signup_notified_at, created_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_profile" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (profile.signup_notified_at) {
      return new Response(JSON.stringify({ ok: true, skipped: "already_notified" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip if user is a trainer (don't notify about trainer itself)
    const { data: trainerRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "trainer")
      .maybeSingle();
    if (trainerRole) {
      await admin.from("profiles").update({ signup_notified_at: new Date().toISOString() }).eq("user_id", user.id);
      return new Response(JSON.stringify({ ok: true, skipped: "is_trainer" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const provider = (user.app_metadata?.provider as string) || "email";
    const method = provider === "google" ? "Google OAuth" : "Email";

    const msg =
      `🆕 <b>Новая регистрация</b>\n\n` +
      `👤 ${escapeHtml(profile.full_name || "—")}\n` +
      `📧 ${escapeHtml(profile.email || "—")}\n` +
      `📱 ${escapeHtml(profile.phone || "—")}\n` +
      `🔑 ${escapeHtml(method)}`;

    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      throw new Error("Telegram not configured");
    }

    const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: "HTML" }),
    });
    if (!tgRes.ok) {
      const body = await tgRes.text();
      console.error("Telegram error", tgRes.status, body);
      // Don't mark notified — allow retry
      return new Response(JSON.stringify({ ok: false, error: "telegram_failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin
      .from("profiles")
      .update({ signup_notified_at: new Date().toISOString() })
      .eq("user_id", user.id);

    return new Response(JSON.stringify({ ok: true, sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-signup error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
