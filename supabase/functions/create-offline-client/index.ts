import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await anonClient.auth.getUser();
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "trainer")
      .maybeSingle();
    if (!roleData) return json({ error: "Forbidden: trainer role required" }, 403);

    const body = await req.json();
    const full_name: string = (body?.full_name ?? "").toString().trim();
    const phoneRaw: string = (body?.phone ?? "").toString().trim();
    const emailRaw: string = (body?.email ?? "").toString().trim().toLowerCase();
    const preferred_language: string = body?.preferred_language === "en" ? "en" : "ru";

    if (full_name.length < 2 || full_name.length > 100) {
      return json({ error: "Invalid name (2-100 characters)" }, 400);
    }
    if (phoneRaw && phoneRaw.length > 20) return json({ error: "Invalid phone" }, 400);
    if (emailRaw && (emailRaw.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw))) {
      return json({ error: "Invalid email" }, 400);
    }

    const email = emailRaw || `offline.${crypto.randomUUID().slice(0, 12)}@limassol-fitness.local`;
    const password = crypto.randomUUID() + crypto.randomUUID();

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone: phoneRaw || "" },
    });

    if (createError || !created?.user) {
      console.error("create-offline-client error:", createError);
      return json({ error: createError?.message || "Failed to create client" }, 400);
    }

    const newUserId = created.user.id;

    await admin.from("user_roles").insert({ user_id: newUserId, role: "client" });

    // Ensure profile fields (profile row is created by the auth trigger).
    await admin
      .from("profiles")
      .update({ full_name, phone: phoneRaw || "", preferred_language })
      .eq("user_id", newUserId);

    // NOTE: intentionally no package is created — the trainer adds one later if needed.
    return json({ success: true, user_id: newUserId, full_name });
  } catch (error) {
    console.error("create-offline-client fatal:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return json({ error: msg }, 500);
  }
});
