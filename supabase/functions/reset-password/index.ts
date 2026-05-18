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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action } = body;

    // ACTION: send_new_password — lookup by phone OR email, generate a strong password,
    // update the auth user, deliver via Telegram. One-shot, no codes needed.
    if (action === "send_new_password") {
      const mode = body.mode === "email" ? "email" : "phone";
      const identifier = String(body.identifier || "").trim();
      if (!identifier || identifier.length < 5) {
        return json({ error: "invalid_identifier" }, 400);
      }

      // Lookup profile
      let profileQuery = adminClient
        .from("profiles")
        .select("user_id, full_name, telegram_chat_id, phone, email");
      if (mode === "phone") {
        profileQuery = profileQuery.eq("phone", identifier);
      } else {
        profileQuery = profileQuery.ilike("email", identifier);
      }
      const { data: profile } = await profileQuery.maybeSingle();

      if (!profile) {
        return json({ error: "not_found" }, 404);
      }
      if (!profile.telegram_chat_id) {
        return json({ error: "no_telegram" }, 400);
      }

      // Generate strong unique password — bypasses HIBP because it's random
      const genPassword = () => {
        const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
        const digits = "23456789";
        const symbols = "!@#$%&*+-";
        const all = letters + digits + symbols;
        const pick = (s: string, n: number) => {
          let out = "";
          const buf = new Uint32Array(n);
          crypto.getRandomValues(buf);
          for (let i = 0; i < n; i++) out += s[buf[i] % s.length];
          return out;
        };
        // Guaranteed mix: 2 upper, 2 lower, 2 digits, 2 symbols + 4 random
        const parts =
          pick("ABCDEFGHJKLMNPQRSTUVWXYZ", 2) +
          pick("abcdefghjkmnpqrstuvwxyz", 2) +
          pick(digits, 2) +
          pick(symbols, 2) +
          pick(all, 4);
        // Shuffle
        const arr = parts.split("");
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return "Fit-" + arr.join("");
      };

      // Try up to 3 times in case HIBP rejects (extremely unlikely with random)
      let newPassword = "";
      let lastErr: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        newPassword = genPassword();
        const { error } = await adminClient.auth.admin.updateUserById(profile.user_id, {
          password: newPassword,
        });
        if (!error) { lastErr = null; break; }
        lastErr = error;
        const msg = (error.message || "").toLowerCase();
        if (!msg.includes("pwned") && !msg.includes("breach") && !msg.includes("compromised")) break;
      }
      if (lastErr) {
        console.error("updateUserById failed:", lastErr);
        return json({ error: "update_failed", message: lastErr.message }, 500);
      }

      // Send via Telegram
      const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
      const tgText =
        `🔐 <b>Новый пароль для входа</b>\n\n` +
        `Логин: <code>${mode === "phone" ? profile.phone : (profile.email || profile.phone)}</code>\n` +
        `Пароль: <code>${newPassword}</code>\n\n` +
        `Войдите и при желании смените пароль в профиле.\n` +
        `Если вы не запрашивали сброс — сообщите тренеру.`;
      const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: profile.telegram_chat_id,
          text: tgText,
          parse_mode: "HTML",
        }),
      });
      if (!tgRes.ok) {
        const errText = await tgRes.text();
        console.error("Telegram send failed:", errText);
        return json({ error: "telegram_failed" }, 500);
      }

      // Fetch the auth email so the client can auto-login with one tap
      let authEmail: string | null = null;
      try {
        const { data: userRes } = await adminClient.auth.admin.getUserById(profile.user_id);
        authEmail = userRes?.user?.email ?? null;
      } catch (e) {
        console.warn("getUserById failed:", e);
      }

      return json({
        success: true,
        delivered_via: "telegram",
        auto_login: authEmail ? { email: authEmail, password: newPassword } : null,
      });
    }

    // ACTION: request_reset — legacy code-based flow (kept for backwards compat)
    if (action === "request_reset") {
      const { phone } = body;
      if (!phone || typeof phone !== "string" || phone.length < 5) {
        return json({ error: "Invalid phone number" }, 400);
      }

      // Find profile by phone
      const { data: profile } = await adminClient
        .from("profiles")
        .select("user_id, full_name, telegram_chat_id, phone")
        .eq("phone", phone)
        .maybeSingle();

      if (!profile) {
        return json({ error: "not_found" }, 404);
      }

      if (!profile.telegram_chat_id) {
        return json({ error: "no_telegram" }, 400);
      }

      // Generate 6-digit code
      const code = String(Math.floor(100000 + Math.random() * 900000));

      // Store code
      await adminClient.from("password_reset_codes").insert({
        phone,
        code,
      });

      // Send code via Telegram
      const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: profile.telegram_chat_id,
          text: `🔐 Ваш код для сброса пароля: <b>${code}</b>\n\nКод действителен 10 минут.\nЕсли вы не запрашивали сброс — проигнорируйте это сообщение.`,
          parse_mode: "HTML",
        }),
      });

      return json({ success: true });
    }

    // ACTION: verify_and_reset — client enters code + new password
    if (action === "verify_and_reset") {
      const { phone, code, new_password } = body;
      if (!phone || !code || !new_password) {
        return json({ error: "Missing fields" }, 400);
      }
      if (new_password.length < 8) {
        return json({ error: "weak_password", message: "Password must be at least 8 characters" }, 400);
      }

      // Find valid code
      const { data: resetCode } = await adminClient
        .from("password_reset_codes")
        .select("*")
        .eq("phone", phone)
        .eq("code", code)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!resetCode) {
        return json({ error: "invalid_code" }, 400);
      }

      // Mark code as used
      await adminClient
        .from("password_reset_codes")
        .update({ used: true })
        .eq("id", resetCode.id);

      // Find user by phone
      const { data: profile } = await adminClient
        .from("profiles")
        .select("user_id")
        .eq("phone", phone)
        .maybeSingle();

      if (!profile) {
        return json({ error: "User not found" }, 404);
      }

      // Update password
      const { error } = await adminClient.auth.admin.updateUserById(profile.user_id, {
        password: new_password,
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();
        let code = "update_failed";
        if (msg.includes("pwned") || msg.includes("compromised") || msg.includes("breach")) code = "pwned_password";
        else if (msg.includes("weak") || msg.includes("short") || msg.includes("at least")) code = "weak_password";
        return json({ error: code, message: error.message }, 400);
      }

      return json({ success: true });
    }

    // ACTION: trainer_reset — trainer resets client password (requires auth + trainer role)
    if (action === "trainer_reset") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return json({ error: "Unauthorized" }, 401);
      }

      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user } } = await authClient.auth.getUser();
      if (!user) {
        return json({ error: "Unauthorized" }, 401);
      }

      // Check trainer role
      const { data: roleData } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "trainer")
        .maybeSingle();

      if (!roleData) {
        return json({ error: "Forbidden" }, 403);
      }

      const { client_user_id, new_password } = body;
      if (!client_user_id || !new_password || new_password.length < 8) {
        return json({ error: "Password must be at least 8 characters" }, 400);
      }

      const { error } = await adminClient.auth.admin.updateUserById(client_user_id, {
        password: new_password,
      });

      if (error) {
        return json({ error: error.message }, 500);
      }

      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("reset-password error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
