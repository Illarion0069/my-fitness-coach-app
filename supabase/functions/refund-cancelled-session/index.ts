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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Authn: require a valid JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authz: only trainers may refund
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: isTrainer } = await supabase.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'trainer',
    });
    if (!isTrainer) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    const { session_id, cancelled_date } = await req.json();

    if (!session_id || !cancelled_date) {
      return new Response(
        JSON.stringify({ error: 'session_id and cancelled_date are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look for a ledger entry that was deducted for this session+date
    // Support both old key format (cron_user_<userId>_<date>) and new (cron_session_<sessionId>_<date>)
    const { data: session } = await supabase
      .from('scheduled_sessions')
      .select('id,user_id,package_id')
      .eq('id', session_id)
      .single();

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const possibleKeys = [
      `cron_session_${session_id}_${cancelled_date}`,
      `cron_user_${session.user_id}_${cancelled_date}`,
    ];

    const { data: ledgerEntries } = await supabase
      .from('session_ledger')
      .select('id,idempotency_key,package_id,used_before,used_after,delta')
      .eq('session_id', session_id)
      .in('idempotency_key', possibleKeys)
      .eq('reason', 'cron_deduct');

    if (!ledgerEntries || ledgerEntries.length === 0) {
      // No deduction found for this date — nothing to refund
      console.log(`[refund] No deduction found for session ${session_id} on ${cancelled_date}`);
      return new Response(
        JSON.stringify({ refunded: false, reason: 'no_deduction_found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const entry = ledgerEntries[0];
    const refundKey = `refund_${entry.idempotency_key}`;

    // Check if already refunded
    const { data: existingRefund } = await supabase
      .from('session_ledger')
      .select('id')
      .eq('idempotency_key', refundKey)
      .limit(1);

    if (existingRefund && existingRefund.length > 0) {
      console.log(`[refund] Already refunded: ${refundKey}`);
      return new Response(
        JSON.stringify({ refunded: false, reason: 'already_refunded' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const packageId = entry.package_id;

    // Get current package state
    const { data: pkg } = await supabase
      .from('client_packages')
      .select('id,used_sessions,total_sessions,is_active')
      .eq('id', packageId)
      .single();

    if (!pkg) {
      return new Response(
        JSON.stringify({ refunded: false, reason: 'package_not_found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newUsed = Math.max(pkg.used_sessions - 1, 0);

    // Write refund ledger entry
    const { error: ledgerError } = await supabase
      .from('session_ledger')
      .insert({
        user_id: session.user_id,
        package_id: packageId,
        delta: -1,
        reason: 'refund_cancelled',
        session_id: session_id,
        used_before: pkg.used_sessions,
        used_after: newUsed,
        idempotency_key: refundKey,
      });

    if (ledgerError) {
      console.error('[refund] Ledger write failed:', ledgerError.message);
      return new Response(
        JSON.stringify({ error: ledgerError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update package
    const updateData: Record<string, unknown> = { used_sessions: newUsed };
    if (!pkg.is_active && newUsed < pkg.total_sessions) {
      updateData.is_active = true;
    }

    await supabase
      .from('client_packages')
      .update(updateData)
      .eq('id', packageId);

    console.log(`[refund] Refunded session ${session_id} date ${cancelled_date}, pkg ${packageId}: ${pkg.used_sessions} → ${newUsed}`);

    return new Response(
      JSON.stringify({ refunded: true, used_before: pkg.used_sessions, used_after: newUsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[refund] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
