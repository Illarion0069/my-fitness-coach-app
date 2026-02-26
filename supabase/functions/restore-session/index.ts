import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is authenticated trainer
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify trainer role
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { data: roleData } = await anonClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'trainer')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden: trainer only' }), { status: 403, headers: corsHeaders });
    }

    const { sessionId, userId } = await req.json();
    if (!sessionId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing sessionId or userId' }), { status: 400, headers: corsHeaders });
    }

    // Use service role for the actual restoration (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch the session to determine package_id
    const { data: session } = await supabase
      .from('scheduled_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    console.log(`[restore-session] Deleting session ${sessionId}, user ${userId}, is_recurring=${session?.is_recurring}, package_id=${session?.package_id}`);

    // Delete the session
    const { error: deleteErr } = await supabase
      .from('scheduled_sessions')
      .delete()
      .eq('id', sessionId);

    if (deleteErr) {
      console.error('[restore-session] Delete error:', deleteErr.message);
      return new Response(JSON.stringify({ error: deleteErr.message }), { status: 500, headers: corsHeaders });
    }

    // Restore balance only for one-off sessions (recurring don't immediately deduct)
    if (session && !session.is_recurring) {
      let pkg = null;

      // Priority 1: restore to the exact package this session was billed to
      if (session.package_id) {
        const { data: linkedPkg } = await supabase
          .from('client_packages')
          .select('*')
          .eq('id', session.package_id)
          .maybeSingle();

        if (linkedPkg && linkedPkg.used_sessions > 0) {
          pkg = linkedPkg;
          console.log(`[restore-session] Found linked package ${pkg.id}, used=${pkg.used_sessions}/${pkg.total_sessions}`);
        }
      }

      // Priority 2: fallback — any package for this user with used_sessions > 0
      // (no is_active filter: package may have been auto-deactivated when exhausted)
      if (!pkg) {
        const { data: anyPkgs } = await supabase
          .from('client_packages')
          .select('*')
          .eq('user_id', userId)
          .gt('used_sessions', 0)
          .order('created_at', { ascending: false })
          .limit(1);

        pkg = anyPkgs?.[0] || null;
        if (pkg) {
          console.log(`[restore-session] Fallback package ${pkg.id}, used=${pkg.used_sessions}/${pkg.total_sessions}`);
        }
      }

      if (pkg) {
        const newUsed = pkg.used_sessions - 1;
        const { error: restoreErr } = await supabase
          .from('client_packages')
          .update({
            used_sessions: newUsed,
            is_active: true,
          })
          .eq('id', pkg.id)
          .eq('used_sessions', pkg.used_sessions); // optimistic lock

        if (restoreErr) {
          console.error('[restore-session] Restore error:', restoreErr.message);
          return new Response(JSON.stringify({ error: restoreErr.message }), { status: 500, headers: corsHeaders });
        }

        // Write ledger entry
        await supabase.from('session_ledger').insert({
          user_id: userId,
          package_id: pkg.id,
          delta: -1,
          reason: 'trainer_cancel',
          session_id: sessionId,
          used_before: pkg.used_sessions,
          used_after: newUsed,
          idempotency_key: `trainer_cancel_${sessionId}`,
        });

        console.log(`[restore-session] ✓ Restored: pkg=${pkg.id} used ${pkg.used_sessions} → ${newUsed}, is_active=true`);
        return new Response(JSON.stringify({ success: true, restored: true, packageId: pkg.id, newUsed }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        console.log(`[restore-session] No package found to restore for user ${userId}`);
        return new Response(JSON.stringify({ success: true, restored: false, reason: 'no package with used_sessions > 0' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Recurring session deleted — no balance to restore
    return new Response(JSON.stringify({ success: true, restored: false, reason: 'recurring session' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[restore-session] Fatal:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
