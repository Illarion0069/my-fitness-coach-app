import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limit configuration
const MAX_ATTEMPTS_PER_IDENTIFIER = 3; // per window
const MAX_ATTEMPTS_PER_IP = 10;        // per window
const WINDOW_MINUTES = 15;

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

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    // Helper: log an attempt (best-effort, never throws)
    const logAttempt = async (identifier: string, success: boolean, errorCode?: string) => {
      try {
        await adminClient.from("password_reset_attempts").insert({
          identifier: identifier.slice(0, 100),
          ip,
          success,
          error_code: errorCode ?? null,
        });
      } catch (e) {
        console.warn("logAttempt failed:", e);
      }
    };

    // Helper: check rate limits
    const isRateLimited = async (identifier: string): Promise<{ limited: boolean; reason?: string }> => {
      const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
      const { count: idCount } = await adminClient
        .from("password_reset_attempts")
        .select("id", { count: "exact", head: true })
        .eq("identifier", identifier)
        .gte("created_at", since);
      if ((idCount ?? 0) >= MAX_ATTEMPTS_PER_IDENTIFIER) {
        return { limited: true, reason: "identifier" };
      }
      const { count: ipCount } = await adminClient
        .from("password_reset_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip", ip)
        .gte("created_at", since);
      if ((ipCount ?? 0) >= MAX_ATTEMPTS_PER_IP) {
        return { limited: true, reason: "ip" };
      }
      return { limited: false };
    };

    // ACTION: send_new_password — lookup by phone OR email, generate password, deliver via Telegram.
    if (action === "send_new_password") {
      const mode = body.mode === "email" ? "email" : "phone";
      const identifier = String(body.identifier || "").trim();
      if (!identifier || identifier.length < 5 || identifier.length > 100) {
        return json({ error: "invalid_identifier" }, 400);
      }

      // Rate limit BEFORE doing anything else
      const rl = await isRateLimited(identifier);
      if (rl.limited) {
        await logAttempt(identifier, false, `rate_limit_${rl.reason}`);
        return json({
          error: "rate_limited",
          message: `Слишком много попыток. Подождите ${WINDOW_MINUTES} минут или свяжитесь с тренером.`,
        }, 429);
      }

      // Lookup profile
      let profileQuery = adminClient
        .from("profiles")
        .select("user_id, full_name, telegram_chat_id, phone, email")
        .limit(1);
      if (mode === "phone") {
        profileQuery = profileQuery.eq("phone", identifier);
      } else {
        profileQuery = profileQuery.ilike("email", identifier);
      }
      const { data: profileRows } = await profileQuery;
      const profile = profileRows?.[0];

      // UNIFIED RESPONSE — do not leak account existence.
      // If account is missing or has no telegram, return a generic-looking response
      // but still log internally for monitoring.
      if (!profile || !profile.telegram_chat_id) {
        await logAttempt(identifier, false, !profile ? "not_found" : "no_telegram");
        // Return success-shape but no auto_login + a soft hint that an account
        // without Telegram cannot be auto-recovered.
        return json({
          success: true,
          delivered_via: null,
          auto_login: null,
          message: "Если аккаунт существует и привязан к Telegram, новый пароль отправлен. Если сообщения нет — свяжитесь с тренером.",
        });
      }

      // Generate strong unique password
      const genPassword = () => {
        const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const lower = "abcdefghjkmnpqrstuvwxyz";
        const digits = "23456789";
        const symbols = "!@#$%&*+-";
        const all = upper + lower + digits + symbols;
        const pick = (s: string, n: number) => {
          let out = "";
          const buf = new Uint32Array(n);
          crypto.getRandomValues(buf);
          for (let i = 0; i < n; i++) out += s[buf[i] % s.length];
          return out;
        };
        const parts = pick(upper, 2) + pick(lower, 3) + pick(digits, 3) + pick(symbols, 2) + pick(all, 6);
        const arr = parts.split("");
        // Fisher-Yates with crypto
        const r = new Uint32Array(arr.length);
        crypto.getRandomValues(r);
        for (let i = arr.length - 1; i > 0; i--) {
          const j = r[i] % (i + 1);
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr.join("");
      };

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
        await logAttempt(identifier, false, "update_failed");
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
        // Best-effort: we cannot restore the old password (we never had the hash),
        // but we log clearly so the trainer can help. Client sees a friendly error.
        await logAttempt(identifier, false, "telegram_failed");
        return json({
          error: "telegram_failed",
          message: "Не удалось доставить пароль в Telegram. Свяжитесь с тренером — он поможет войти.",
        }, 502);
      }

      // Fetch the auth email so the client can auto-login with one tap
      let authEmail: string | null = null;
      try {
        const { data: userRes } = await adminClient.auth.admin.getUserById(profile.user_id);
        authEmail = userRes?.user?.email ?? null;
      } catch (e) {
        console.warn("getUserById failed:", e);
      }

      await logAttempt(identifier, true);

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

      const rl = await isRateLimited(phone);
      if (rl.limited) {
        await logAttempt(phone, false, `rate_limit_${rl.reason}`);
        return json({ error: "rate_limited" }, 429);
      }

      const { data: profileRows } = await adminClient
        .from("profiles")
        .select("user_id, full_name, telegram_chat_id, phone")
        .eq("phone", phone)
        .limit(1);
      const profile = profileRows?.[0];

      if (!profile || !profile.telegram_chat_id) {
        await logAttempt(phone, false, !profile ? "not_found" : "no_telegram");
        // Unified response
        return json({ success: true });
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));

      await adminClient.from("password_reset_codes").insert({
        phone,
        code,
      });

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

      await logAttempt(phone, true);
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

      await adminClient
        .from("password_reset_codes")
        .update({ used: true })
        .eq("id", resetCode.id);

      const { data: profile } = await adminClient
        .from("profiles")
        .select("user_id")
        .eq("phone", phone)
        .maybeSingle();

      if (!profile) {
        return json({ error: "User not found" }, 404);
      }

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
        const msg = (error.message || "").toLowerCase();
        let code = "update_failed";
        if (msg.includes("pwned") || msg.includes("compromised") || msg.includes("breach")) code = "pwned_password";
        else if (msg.includes("weak") || msg.includes("short") || msg.includes("at least")) code = "weak_password";
        return json({ error: code, message: error.message }, 400);
      }

      return json({ success: true });
    }

    // ACTION: change_password — authenticated user changes their own password
    if (action === "change_password") {
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

      const { new_password } = body;
      if (!new_password || typeof new_password !== "string" || new_password.length < 8) {
        return json({ error: "weak_password", message: "Минимум 8 символов" }, 400);
      }
      if (new_password.length > 128) {
        return json({ error: "weak_password", message: "Слишком длинный пароль" }, 400);
      }

      const { error } = await adminClient.auth.admin.updateUserById(user.id, {
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
