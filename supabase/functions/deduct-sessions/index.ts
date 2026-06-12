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
  recurrence_end_date: string | null;
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

type TrainerAvailability = {
  blockedDates: Set<string>;
  daysOff: Set<number>;
};

function buildRecurringDueDates(
  session: ScheduledSession,
  todayStr: string,
  trainerAvailability: Map<string, TrainerAvailability>,
  trainerIdBySession: Map<string, string>,
): string[] {
  if (!session.is_recurring || session.recurrence_day === null) return [];

  // Strict: deduct ONLY for today. No catch-up of past missed dates.
  // If cron didn't run on a past date, that's a miss — do not retroactively deduct,
  // it leads to double-charging when a new package appears after exhaustion.
  if (dayOfWeek(todayStr) !== session.recurrence_day) return [];

  const exceptions = new Set((session.recurring_exceptions || []).map(String));
  if (exceptions.has(todayStr)) return [];

  // Recurring template must have started by today
  if (session.session_date > todayStr) return [];

  const trainerId = trainerIdBySession.get(session.id);
  const availability = trainerId ? trainerAvailability.get(trainerId) : undefined;
  if (availability?.blockedDates.has(todayStr)) return [];
  if (availability?.daysOff.has(dayOfWeek(todayStr))) return [];

  return [todayStr];
}

function isSessionDateAllowed(
  session: ScheduledSession,
  trainerAvailability: Map<string, TrainerAvailability>,
  trainerIdBySession: Map<string, string>,
): boolean {
  const trainerId = trainerIdBySession.get(session.id);
  const availability = trainerId ? trainerAvailability.get(trainerId) : undefined;
  if (!availability) return true;

  const dow = dayOfWeek(session.session_date);
  if (availability.blockedDates.has(session.session_date)) return false;
  if (availability.daysOff.has(dow)) return false;
  return true;
}

async function getLatestValidPackage(supabase: any, userId: string): Promise<ClientPackage | null> {
  const { data: packages, error } = await supabase
    .from('client_packages')
    .select('id,user_id,is_active,used_sessions,total_sessions,expires_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;

  for (const pkg of (packages || []) as ClientPackage[]) {
    if (pkg.expires_at && new Date(pkg.expires_at) < new Date()) {
      await supabase.from('client_packages').update({ is_active: false }).eq('id', pkg.id);
      continue;
    }

    if (pkg.used_sessions < pkg.total_sessions) {
      return pkg;
    }

    await supabase.from('client_packages').update({ is_active: false }).eq('id', pkg.id);
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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
      .select('id,user_id,trainer_user_id,session_date,is_recurring,recurrence_day,recurring_exceptions,is_deducted,deducted_at')
      .eq('is_recurring', false)
      .eq('is_deducted', false)
      .lte('session_date', todayStr);

    if (oneOffError) console.error('[deduct-sessions] Error fetching one-off:', oneOffError.message);

    // 2) Recurring sessions: process all and calculate due occurrences up to today
    const { data: recurringSessions, error: recurringError } = await supabase
      .from('scheduled_sessions')
      .select('id,user_id,trainer_user_id,session_date,is_recurring,recurrence_day,recurring_exceptions,is_deducted,deducted_at')
      .eq('is_recurring', true);

    if (recurringError) console.error('[deduct-sessions] Error fetching recurring:', recurringError.message);

    // 3) Trainer availability: blocked dates and weekly days off
    const { data: workingHours, error: whError } = await supabase
      .from('trainer_working_hours')
      .select('trainer_user_id,blocked_dates,days_off');

    if (whError) console.error('[deduct-sessions] Error fetching working hours:', whError.message);

    const trainerAvailability = new Map<string, TrainerAvailability>();
    for (const row of (workingHours || []) as Array<{ trainer_user_id: string; blocked_dates: string[] | null; days_off: number[] | null }>) {
      trainerAvailability.set(row.trainer_user_id, {
        blockedDates: new Set((row.blocked_dates || []).map(String)),
        daysOff: new Set((row.days_off || []).map(Number)),
      });
    }

    // Map session.id -> trainer_user_id (used inside helpers)
    const trainerIdBySession = new Map<string, string>();
    for (const s of [...(oneOffSessions || []), ...(recurringSessions || [])] as Array<ScheduledSession & { trainer_user_id: string }>) {
      if (s.trainer_user_id) trainerIdBySession.set(s.id, s.trainer_user_id);
    }

    type DeductionCandidate = {
      session: ScheduledSession;
      dueDates: string[];
      dueCount: number;
    };

    const candidates: DeductionCandidate[] = [];

    for (const session of (oneOffSessions || []) as ScheduledSession[]) {
      if (!isSessionDateAllowed(session, trainerAvailability, trainerIdBySession)) {
        console.log(`  Skip one-off ${session.id} on ${session.session_date} — date is blocked / day off`);
        continue;
      }
      candidates.push({ session, dueDates: [session.session_date], dueCount: 1 });
    }

    for (const session of (recurringSessions || []) as ScheduledSession[]) {
      const dueDates = buildRecurringDueDates(session, todayStr, trainerAvailability, trainerIdBySession);
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
        const pkg = await getLatestValidPackage(supabase, session.user_id);
        if (!pkg) {
          console.log(`  User ${session.user_id} — no valid active package, skip (${dueCount} due)`);
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
          key: `cron_session_${session.id}_${date}`,
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
        const packageUpdates: Record<string, unknown> = { used_sessions: actualNewUsed };
        if (actualNewUsed >= pkg.total_sessions) {
          packageUpdates.is_active = false;
        }

        const { data: updatedRows, error: updatePackageError } = await supabase
          .from('client_packages')
          .update(packageUpdates)
          .eq('id', pkg.id)
          .eq('used_sessions', pkg.used_sessions) // optimistic lock
          .select('id');

        if (updatePackageError) {
          errors.push(`pkg ${pkg.id}: ${updatePackageError.message}`);
          continue;
        }

        if (!updatedRows || updatedRows.length === 0) {
          console.log(`  Session ${session.id} — optimistic lock failed for pkg ${pkg.id} (stale used_sessions=${pkg.used_sessions}), retrying`);
          // Re-fetch and retry once
          const retryPkg = await getLatestValidPackage(supabase, session.user_id);
          if (!retryPkg) { skipped += dueCount; continue; }
          const retryNewUsed = retryPkg.used_sessions + actualDeduct;
          const retryUpdates: Record<string, unknown> = { used_sessions: retryNewUsed };
          if (retryNewUsed >= retryPkg.total_sessions) retryUpdates.is_active = false;
          const { data: retryRows } = await supabase
            .from('client_packages')
            .update(retryUpdates)
            .eq('id', retryPkg.id)
            .eq('used_sessions', retryPkg.used_sessions)
            .select('id');
          if (!retryRows || retryRows.length === 0) {
            errors.push(`session ${session.id}: optimistic lock failed twice for pkg ${retryPkg.id}`);
            continue;
          }
          // Update pkg reference for ledger entries below
          Object.assign(pkg, retryPkg);
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
            .update({ used_sessions: pkg.used_sessions, is_active: pkg.is_active })
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