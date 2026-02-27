import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ScheduledSession = {
  id: string;
  user_id: string;
  session_date: string;
  is_recurring: boolean;
  recurrence_day: number | null;
  recurring_exceptions: string[] | null;
  is_deducted: boolean;
  deducted_at: string | null;
};

type ClientPackage = {
  id: string;
  user_id: string;
  is_active: boolean;
  used_sessions: number;
  total_sessions: number;
  expires_at: string | null;
};

/** Get current date/time in Cyprus timezone */
function getCyprusDate(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Nicosia',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  return new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:00`);
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateStr(date);
}

function dayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

function buildRecurringDueDates(session: ScheduledSession, todayStr: string): string[] {
  if (!session.is_recurring || session.recurrence_day === null) return [];

  const exceptions = new Set((session.recurring_exceptions || []).map(String));
  const lastDeductedDate = session.deducted_at ? toDateStr(new Date(session.deducted_at)) : null;

  // Only catch up within the last 7 days to prevent over-deduction
  const maxCatchupStart = addDays(todayStr, -7);

  let cursor: string;
  if (lastDeductedDate) {
    cursor = addDays(lastDeductedDate, 1);
  } else {
    // Never go further back than 7 days from today
    cursor = session.session_date > maxCatchupStart ? session.session_date : maxCatchupStart;
  }

  if (cursor > todayStr) return [];

  const dueDates: string[] = [];
  while (cursor <= todayStr) {
    if (dayOfWeek(cursor) === session.recurrence_day && !exceptions.has(cursor)) {
      dueDates.push(cursor);
    }
    cursor = addDays(cursor, 1);
  }

  return dueDates;
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
    const todayStr = toDateStr(cyprusNow);

    console.log(`[deduct-sessions] Running for Cyprus date ${todayStr}`);

    // 1) One-off sessions: deduct any pending session up to today (catch-up)
    const { data: oneOffSessions, error: oneOffError } = await supabase
      .from('scheduled_sessions')
      .select('id,user_id,session_date,is_recurring,recurrence_day,recurring_exceptions,is_deducted,deducted_at')
      .eq('is_recurring', false)
      .eq('is_deducted', false)
      .lte('session_date', todayStr);

    if (oneOffError) console.error('[deduct-sessions] Error fetching one-off:', oneOffError.message);

    // 2) Recurring sessions: process all and calculate due occurrences up to today
    const { data: recurringSessions, error: recurringError } = await supabase
      .from('scheduled_sessions')
      .select('id,user_id,session_date,is_recurring,recurrence_day,recurring_exceptions,is_deducted,deducted_at')
      .eq('is_recurring', true);

    if (recurringError) console.error('[deduct-sessions] Error fetching recurring:', recurringError.message);

    type DeductionCandidate = {
      session: ScheduledSession;
      dueDates: string[];
      dueCount: number;
    };

    const candidates: DeductionCandidate[] = [];

    for (const session of (oneOffSessions || []) as ScheduledSession[]) {
      candidates.push({ session, dueDates: [session.session_date], dueCount: 1 });
    }

    for (const session of (recurringSessions || []) as ScheduledSession[]) {
      const dueDates = buildRecurringDueDates(session, todayStr);
      if (dueDates.length > 0) {
        candidates.push({ session, dueDates, dueCount: dueDates.length });
      }
    }

    // Priority: explicit one-off sessions before recurring templates
    candidates.sort((a, b) => Number(a.session.is_recurring) - Number(b.session.is_recurring));

    console.log(`[deduct-sessions] Total sessions with pending deductions: ${candidates.length}`);

    let deductedSessions = 0;
    let skipped = 0;
    const errors: string[] = [];

    // In-run guard: never deduct more than once per user per date in a single execution
    const reservedKeys = new Set<string>();

    for (const candidate of candidates) {
      const { session, dueCount, dueDates } = candidate;

      try {
        const { data: packages, error: packageError } = await supabase
          .from('client_packages')
          .select('id,user_id,is_active,used_sessions,total_sessions,expires_at')
          .eq('user_id', session.user_id)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1);

        if (packageError) {
          errors.push(`session ${session.id}: package fetch failed (${packageError.message})`);
          continue;
        }

        const pkg = (packages?.[0] as ClientPackage | undefined);
        if (!pkg) {
          console.log(`  User ${session.user_id} — no active package, skip (${dueCount} due)`);
          skipped += dueCount;
          continue;
        }

        if (pkg.expires_at && new Date(pkg.expires_at) < new Date()) {
          console.log(`  User ${session.user_id} — package ${pkg.id} expired (${pkg.expires_at}), skip`);
          skipped += dueCount;
          continue;
        }

        const remaining = Math.max(pkg.total_sessions - pkg.used_sessions, 0);
        if (remaining <= 0) {
          console.log(`  User ${session.user_id} — package ${pkg.id} fully used (${pkg.used_sessions}/${pkg.total_sessions}), skip`);
          skipped += dueCount;
          continue;
        }

        const toDeductNow = Math.min(dueCount, remaining);

        const dueEntries = dueDates.slice(0, toDeductNow).map((date) => ({
          date,
          key: `cron_user_${session.user_id}_${date}`,
        }));

        const idempotencyKeys = dueEntries.map((entry) => entry.key);

        // Check already processed in DB
        const { data: existingEntries } = await supabase
          .from('session_ledger')
          .select('idempotency_key')
          .in('idempotency_key', idempotencyKeys);

        const alreadyDone = new Set((existingEntries || []).map(e => e.idempotency_key));
        const newEntries = dueEntries.filter(
          (entry) => !alreadyDone.has(entry.key) && !reservedKeys.has(entry.key)
        );

        if (newEntries.length === 0) {
          console.log(`  Session ${session.id} — all due dates already processed, skip`);
          continue;
        }

        const actualDeduct = newEntries.length;
        const actualNewUsed = pkg.used_sessions + actualDeduct;

        const { error: updatePackageError } = await supabase
          .from('client_packages')
          .update({ used_sessions: actualNewUsed })
          .eq('id', pkg.id)
          .eq('used_sessions', pkg.used_sessions); // optimistic lock

        if (updatePackageError) {
          errors.push(`pkg ${pkg.id}: ${updatePackageError.message}`);
          continue;
        }

        // Reserve keys in this run right after successful package update
        for (const entry of newEntries) reservedKeys.add(entry.key);

        // Write ledger entries
        const ledgerEntries = newEntries.map((entry, i) => ({
          user_id: session.user_id,
          package_id: pkg.id,
          delta: 1,
          reason: 'cron_deduct',
          session_id: session.id,
          used_before: pkg.used_sessions + i,
          used_after: pkg.used_sessions + i + 1,
          idempotency_key: entry.key,
        }));

        const { error: ledgerError } = await supabase
          .from('session_ledger')
          .insert(ledgerEntries);

        if (ledgerError) {
          // Rollback package update on any ledger write failure
          await supabase
            .from('client_packages')
            .update({ used_sessions: pkg.used_sessions })
            .eq('id', pkg.id)
            .eq('used_sessions', actualNewUsed);

          for (const entry of newEntries) reservedKeys.delete(entry.key);
          errors.push(`session ${session.id}: ledger write failed (${ledgerError.message})`);
          continue;
        }

        if (!session.is_recurring) {
          const { error: updateSessionError } = await supabase
            .from('scheduled_sessions')
            .update({
              is_deducted: true,
              deducted_at: new Date().toISOString(),
              package_id: pkg.id,
            })
            .eq('id', session.id)
            .eq('is_deducted', false);

          if (updateSessionError) {
            errors.push(`session ${session.id}: ${updateSessionError.message}`);
            continue;
          }
        } else {
          const lastProcessedDate = newEntries[newEntries.length - 1].date;
          const deductedAt = `${lastProcessedDate}T12:00:00.000Z`;

          const { error: updateSessionError } = await supabase
            .from('scheduled_sessions')
            .update({
              is_deducted: false,
              deducted_at: deductedAt,
              package_id: pkg.id,
            })
            .eq('id', session.id);

          if (updateSessionError) {
            errors.push(`session ${session.id}: ${updateSessionError.message}`);
            continue;
          }
        }

        deductedSessions += actualDeduct;
        const notCovered = dueCount - actualDeduct;
        if (notCovered > 0) {
          skipped += notCovered;
          console.log(`  User ${session.user_id} — partial deduction ${actualDeduct}/${dueCount}`);
        }

        console.log(`  ✓ Deducted user=${session.user_id}, pkg=${pkg.id}, count=${actualDeduct}`);
      } catch (sessionErr) {
        const msg = sessionErr instanceof Error ? sessionErr.message : String(sessionErr);
        errors.push(`session ${session.id}: ${msg}`);
      }
    }

    const result = {
      success: true,
      date: todayStr,
      candidates: candidates.length,
      deducted: deductedSessions,
      skipped,
      errors,
    };

    console.log('[deduct-sessions] Done:', JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[deduct-sessions] Fatal error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
