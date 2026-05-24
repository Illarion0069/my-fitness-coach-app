import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// This cron function checks achievements for ALL active clients,
// so rewards are granted even when users don't open the app.

serve(async (req) => {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all client user IDs (users with role 'client')
    const { data: clientRoles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "client");

    if (rolesErr) throw rolesErr;
    if (!clientRoles || clientRoles.length === 0) {
      return new Response(JSON.stringify({ checked: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // For each client, invoke the check-achievements function with service role
    let checked = 0;
    let errors = 0;

    for (const client of clientRoles) {
      try {
        // Create a temporary token for this user by using service role
        // We call the check-achievements logic inline instead of HTTP to avoid auth issues
        const res = await fetch(`${supabaseUrl}/functions/v1/check-achievements`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
            "x-cron-user-id": client.user_id,
          },
        });
        if (res.ok) checked++;
        else errors++;
        await res.text(); // consume body
      } catch {
        errors++;
      }
    }

    return new Response(
      JSON.stringify({ checked, errors, total: clientRoles.length }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("check-achievements-cron error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
