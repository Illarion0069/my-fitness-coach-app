import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Get current date/time in Cyprus timezone */
function getCyprusDate(): Date {
  const now = new Date();
  // Format in Cyprus timezone to get the local date components
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Nicosia',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  return new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:00`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const cyprusNow = getCyprusDate();
    const todayStr = cyprusNow.toISOString().split('T')[0]; // YYYY-MM-DD in Cyprus TZ
    const dayOfWeek = cyprusNow.getDay(); // 0=Sun .. 6=Sat

    console.log(`[deduct-sessions] Running for Cyprus date ${todayStr}, dayOfWeek=${dayOfWeek}`);

    // 1. One-off sessions for today, not yet deducted
    const { data: oneOffSessions, error: e1 } = await supabase
      .from('scheduled_sessions')
      .select('*')
      .eq('session_date', todayStr)
      .eq('is_recurring', false)
      .eq('is_deducted', false);

    if (e1) console.error('[deduct-sessions] Error fetching one-off:', e1.message);

    // 2. Recurring sessions for today's day of week
    const { data: recurringSessions, error: e2 } = await supabase
      .from('scheduled_sessions')
      .select('*')
      .eq('is_recurring', true)
      .eq('recurrence_day', dayOfWeek);

    if (e2) console.error('[deduct-sessions] Error fetching recurring:', e2.message);

    // Filter recurring: skip exceptions & already deducted today
    const recurringToDeduct = (recurringSessions || []).filter(s => {
      if (s.recurring_exceptions?.includes(todayStr)) {
        console.log(`  Session ${s.id} — exception for ${todayStr}, skip`);
        return false;
      }
      if (s.deducted_at) {
        const lastDeducted = new Date(s.deducted_at).toISOString().split('T')[0];
        if (lastDeducted === todayStr) {
          console.log(`  Session ${s.id} — already deducted today, skip`);
          return false;
        }
      }
      return true;
    });

    const allToDeduct = [...(oneOffSessions || []), ...recurringToDeduct];
    console.log(`[deduct-sessions] Total to deduct: ${allToDeduct.length}`);

    let deducted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const session of allToDeduct) {
      try {
        // Find active, non-expired package for this user
        const { data: packages } = await supabase
          .from('client_packages')
          .select('*')
          .eq('user_id', session.user_id)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1);

        const pkg = packages?.[0];
        if (!pkg) {
          console.log(`  User ${session.user_id} — no active package, skip`);
          skipped++;
          continue;
        }

        // Check expiration
        if (pkg.expires_at && new Date(pkg.expires_at) < new Date()) {
          console.log(`  User ${session.user_id} — package ${pkg.id} expired (${pkg.expires_at}), skip`);
          skipped++;
          continue;
        }

        if (pkg.used_sessions >= pkg.total_sessions) {
          console.log(`  User ${session.user_id} — package ${pkg.id} fully used (${pkg.used_sessions}/${pkg.total_sessions}), skip`);
          skipped++;
          continue;
        }

        // Deduct one session from package
        const { error: updPkgErr } = await supabase
          .from('client_packages')
          .update({ used_sessions: pkg.used_sessions + 1 })
          .eq('id', pkg.id)
          .eq('used_sessions', pkg.used_sessions); // optimistic lock — prevents double deduction

        if (updPkgErr) {
          console.error(`  Failed to update package ${pkg.id}:`, updPkgErr.message);
          errors.push(`pkg ${pkg.id}: ${updPkgErr.message}`);
          continue;
        }

        // Mark session as deducted
        await supabase
          .from('scheduled_sessions')
          .update({
            is_deducted: !session.is_recurring,
            deducted_at: new Date().toISOString(),
            package_id: pkg.id,
          })
          .eq('id', session.id);

        deducted++;
        console.log(`  ✓ Deducted user=${session.user_id}, pkg=${pkg.id} (${pkg.used_sessions + 1}/${pkg.total_sessions})`);
      } catch (sessionErr) {
        const msg = sessionErr instanceof Error ? sessionErr.message : String(sessionErr);
        console.error(`  ✗ Error processing session ${session.id}:`, msg);
        errors.push(`session ${session.id}: ${msg}`);
      }
    }

    const result = { success: true, date: todayStr, dayOfWeek, total: allToDeduct.length, deducted, skipped, errors };
    console.log(`[deduct-sessions] Done:`, JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[deduct-sessions] Fatal error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
