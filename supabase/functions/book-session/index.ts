import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action } = body;
    const DEFAULT_DURATION = 60;

    // Helper: authenticate user
    const authHeader = req.headers.get('Authorization');
    const getAuthUser = async () => {
      if (!authHeader?.startsWith('Bearer ')) return null;
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await authClient.auth.getUser();
      return user;
    };

    const timeToMinutes = (t: string): number => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + (m || 0);
    };

    const escapeHtml = (s: string): string =>
      s ? s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : s;

    const MAX_CLIENTS_PER_SLOT = 2; // Split sessions: max 2 clients at the same time

    const countOverlapping = (slotStart: number, slotDuration: number, bookedSessions: { start: number; duration: number }[]): number => {
      const slotEnd = slotStart + slotDuration;
      let count = 0;
      for (const booked of bookedSessions) {
        const bookedEnd = booked.start + booked.duration;
        if (slotStart < bookedEnd && booked.start < slotEnd) count++;
      }
      return count;
    };

    const isSlotBlocked = (slotStart: number, slotDuration: number, bookedSessions: { start: number; duration: number }[]): boolean => {
      return countOverlapping(slotStart, slotDuration, bookedSessions) >= MAX_CLIENTS_PER_SLOT;
    };

    // Helper: get active package with remaining sessions (checks expiry)
    const getActivePackageWithBalance = async (userId: string) => {
      const { data: pkgs } = await supabase
        .from('client_packages')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (!pkgs) return null;

      for (const pkg of pkgs) {
        // Check expiry
        if (pkg.expires_at && new Date(pkg.expires_at) < new Date()) {
          // Auto-deactivate expired package
          await supabase.from('client_packages').update({ is_active: false }).eq('id', pkg.id);
          continue;
        }
        // Check remaining
        if (pkg.used_sessions < pkg.total_sessions) {
          return pkg;
        }
        // Auto-deactivate exhausted package
        if (pkg.used_sessions >= pkg.total_sessions) {
          await supabase.from('client_packages').update({ is_active: false }).eq('id', pkg.id);
        }
      }
      return null;
    };

    // Helper: get trainer info
    const getTrainerInfo = async () => {
      const { data: trainers } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'trainer')
        .limit(1);
      const trainerId = trainers?.[0]?.user_id;
      if (!trainerId) return null;

      let workStart = 7, workEnd = 19, daysOff: number[] = [0];
      const { data: wh } = await supabase
        .from('trainer_working_hours')
        .select('work_start_hour, work_end_hour, days_off')
        .eq('trainer_user_id', trainerId)
        .single();
      if (wh) {
        workStart = wh.work_start_hour;
        workEnd = wh.work_end_hour;
        daysOff = wh.days_off || [0];
      }
      return { trainerId, workStart, workEnd, daysOff };
    };

    // Helper: get booked sessions for a date
    const getBookedSessions = async (date: string, dayOfWeek: number) => {
      const { data: oneOff } = await supabase
        .from('scheduled_sessions')
        .select('session_time, duration_minutes')
        .eq('session_date', date)
        .eq('is_recurring', false);

      const { data: recurring } = await supabase
        .from('scheduled_sessions')
        .select('recurrence_time, duration_minutes, recurring_exceptions')
        .eq('is_recurring', true)
        .eq('recurrence_day', dayOfWeek);

      const bookedSessions: { start: number; duration: number }[] = [];
      (oneOff || []).forEach(s => { if (s.session_time) bookedSessions.push({ start: timeToMinutes(s.session_time.slice(0, 5)), duration: s.duration_minutes || DEFAULT_DURATION }); });
      (recurring || []).forEach(s => {
        // Skip if this date is in recurring_exceptions
        if (s.recurring_exceptions && s.recurring_exceptions.includes(date)) return;
        if (s.recurrence_time) bookedSessions.push({ start: timeToMinutes(s.recurrence_time.slice(0, 5)), duration: s.duration_minutes || DEFAULT_DURATION });
      });
      return bookedSessions;
    };

    // Helper: get trainer blocks for a date
    const getTrainerBlocks = async (date: string, dayOfWeek: number) => {
      const { data: oneOff } = await supabase
        .from('trainer_blocks')
        .select('block_time, duration_minutes')
        .eq('block_date', date)
        .eq('is_recurring', false);

      const { data: recurring } = await supabase
        .from('trainer_blocks')
        .select('block_time, duration_minutes')
        .eq('is_recurring', true)
        .eq('recurrence_day', dayOfWeek);

      const blocks: { start: number; duration: number }[] = [];
      (oneOff || []).forEach(b => { if (b.block_time) blocks.push({ start: timeToMinutes(b.block_time.slice(0, 5)), duration: b.duration_minutes || 60 }); });
      (recurring || []).forEach(b => { if (b.block_time) blocks.push({ start: timeToMinutes(b.block_time.slice(0, 5)), duration: b.duration_minutes || 60 }); });
      return blocks;
    };

    const isSlotBlockedByTrainer = (slotStart: number, slotDuration: number, trainerBlocks: { start: number; duration: number }[]): boolean => {
      const slotEnd = slotStart + slotDuration;
      for (const block of trainerBlocks) {
        const blockEnd = block.start + block.duration;
        if (slotStart < blockEnd && block.start < slotEnd) return true;
      }
      return false;
    };

    // === GET AVAILABLE SLOTS ===
    if (action === 'getSlots') {
      const { date } = body;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return new Response(JSON.stringify({ error: 'Invalid date' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if requester is trainer
      const reqUser = await getAuthUser();
      let isTrainer = false;
      if (reqUser) {
        const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', reqUser.id).eq('role', 'trainer');
        isTrainer = (roles && roles.length > 0);
      }

      const dayOfWeek = new Date(date + 'T12:00:00').getDay();
      const trainer = await getTrainerInfo();
      if (!trainer) {
        return new Response(JSON.stringify({ slots: [], sessionDuration: DEFAULT_DURATION }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (trainer.daysOff.includes(dayOfWeek)) {
        return new Response(JSON.stringify({ slots: [], sessionDuration: DEFAULT_DURATION, dayOff: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const bookedSessions = await getBookedSessions(date, dayOfWeek);
      const trainerBlocks = await getTrainerBlocks(date, dayOfWeek);

      // Check if requested date is today in Cyprus timezone — filter past slots
      const cyprusNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Nicosia' }));
      const cyprusToday = `${cyprusNow.getFullYear()}-${String(cyprusNow.getMonth() + 1).padStart(2, '0')}-${String(cyprusNow.getDate()).padStart(2, '0')}`;
      const isToday = date === cyprusToday;
      const cyprusCurrentMinutes = isToday ? cyprusNow.getHours() * 60 + cyprusNow.getMinutes() : -1;

      const slots: { time: string; available: boolean; booked: number }[] = [];
      for (let h = trainer.workStart; h <= trainer.workEnd; h++) {
        const timeStr = `${String(h).padStart(2, '0')}:00`;
        const slotMinutes = h * 60;
        const bookedCount = countOverlapping(slotMinutes, DEFAULT_DURATION, bookedSessions);
        const blockedByTrainer = isSlotBlockedByTrainer(slotMinutes, DEFAULT_DURATION, trainerBlocks);
        // If today, mark past slots as unavailable
        const isPast = isToday && slotMinutes <= cyprusCurrentMinutes;
        // Clients: any booked or blocked slot is unavailable
        // Trainers: slot available if < MAX_CLIENTS_PER_SLOT and not blocked
        const available = isPast
          ? false
          : isTrainer
            ? bookedCount < MAX_CLIENTS_PER_SLOT && !blockedByTrainer
            : bookedCount === 0 && !blockedByTrainer;
        slots.push({ time: timeStr, available, booked: isTrainer ? bookedCount : 0 });
      }

      return new Response(JSON.stringify({ slots, sessionDuration: DEFAULT_DURATION, maxPerSlot: isTrainer ? MAX_CLIENTS_PER_SLOT : 1, timezone: 'Asia/Nicosia' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === BOOK A SESSION BY TRAINER (for specific client) ===
    if (action === 'trainerBook') {
      const trainerUser = await getAuthUser();
      if (!trainerUser) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: trainerRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', trainerUser.id)
        .eq('role', 'trainer')
        .maybeSingle();

      if (!trainerRole) {
        return new Response(JSON.stringify({ error: 'Forbidden: trainer only' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { client_user_id, date, time } = body;

      if (!client_user_id) {
        return new Response(JSON.stringify({ error: 'client_user_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return new Response(JSON.stringify({ error: 'Invalid date' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (time && !/^\d{2}:\d{2}$/.test(time)) {
        return new Response(JSON.stringify({ error: 'Invalid time' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const dayOfWeek = new Date(date + 'T12:00:00').getDay();
      const trainer = await getTrainerInfo();
      if (!trainer) {
        return new Response(JSON.stringify({ error: 'No trainer found' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (time) {
        const bookedSessions = await getBookedSessions(date, dayOfWeek);
        const trainerBlocks = await getTrainerBlocks(date, dayOfWeek);
        const requestedMinutes = timeToMinutes(time);

        if (isSlotBlockedByTrainer(requestedMinutes, DEFAULT_DURATION, trainerBlocks)) {
          return new Response(JSON.stringify({ error: 'Slot is blocked by trainer' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const currentCount = countOverlapping(requestedMinutes, DEFAULT_DURATION, bookedSessions);
        if (currentCount >= MAX_CLIENTS_PER_SLOT) {
          return new Response(JSON.stringify({ error: 'Slot is not available' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      const pkg = await getActivePackageWithBalance(client_user_id);
      if (!pkg) {
        return new Response(JSON.stringify({ error: 'No active package with remaining sessions' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: createdSession, error: insertError } = await supabase
        .from('scheduled_sessions')
        .insert({
          user_id: client_user_id,
          trainer_user_id: trainer.trainerId,
          session_date: date,
          session_time: time,
          is_recurring: false,
          package_id: pkg.id,
        })
        .select('id')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          return new Response(JSON.stringify({ error: 'Slot already taken' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        throw insertError;
      }

      const newUsed = pkg.used_sessions + 1;
      const { error: updateError } = await supabase
        .from('client_packages')
        .update({
          used_sessions: newUsed,
          is_active: newUsed < pkg.total_sessions,
        })
        .eq('id', pkg.id)
        .eq('used_sessions', pkg.used_sessions);

      if (updateError) {
        await supabase.from('scheduled_sessions').delete().eq('id', createdSession.id);
        return new Response(JSON.stringify({ error: 'Package update conflict, retry please' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: ledgerError } = await supabase
        .from('session_ledger')
        .insert({
          user_id: client_user_id,
          package_id: pkg.id,
          delta: 1,
          reason: 'trainer_book',
          session_id: createdSession.id,
          used_before: pkg.used_sessions,
          used_after: newUsed,
          idempotency_key: `trainer_book_${createdSession.id}`,
        });

      if (ledgerError) {
        await supabase
          .from('client_packages')
          .update({ used_sessions: pkg.used_sessions, is_active: true })
          .eq('id', pkg.id)
          .eq('used_sessions', newUsed);
        await supabase.from('scheduled_sessions').delete().eq('id', createdSession.id);

        return new Response(JSON.stringify({ error: `Ledger write failed: ${ledgerError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, session_id: createdSession.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === BOOK A SESSION ===
    if (action === 'book') {
      const user = await getAuthUser();
      if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { date, time, pendingPayment, selectedPackageSessions, selectedPackagePrice } = body;

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return new Response(JSON.stringify({ error: 'Invalid date' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!time || !/^\d{2}:\d{2}$/.test(time)) {
        return new Response(JSON.stringify({ error: 'Invalid time' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const bookHour = parseInt(time.split(':')[0]);
      const bookMinute = parseInt(time.split(':')[1]);
      if (bookHour < 0 || bookHour > 23 || bookMinute < 0 || bookMinute > 59) {
        return new Response(JSON.stringify({ error: 'Time out of valid range' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Use Cyprus timezone (UTC+2/+3) for past-check to avoid blocking evening slots
      const cyprusNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Nicosia' }));
      const bookingDate = new Date(date + 'T' + time + ':00');
      if (bookingDate < cyprusNow) {
        return new Response(JSON.stringify({ error: 'Cannot book in the past' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Get trainer
      const trainer = await getTrainerInfo();
      if (!trainer) {
        return new Response(JSON.stringify({ error: 'No trainer found' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const dayOfWeek = new Date(date + 'T12:00:00').getDay();
      if (trainer.daysOff.includes(dayOfWeek)) {
        return new Response(JSON.stringify({ error: 'Cannot book on a day off' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (bookHour < trainer.workStart || bookHour >= trainer.workEnd) {
        return new Response(JSON.stringify({ error: 'Time outside working hours' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Check slot availability — clients can only book empty slots, trainers can do splits
      const bookedSessions = await getBookedSessions(date, dayOfWeek);
      const trainerBlocks = await getTrainerBlocks(date, dayOfWeek);
      const requestedMinutes = timeToMinutes(time);
      const currentCount = countOverlapping(requestedMinutes, DEFAULT_DURATION, bookedSessions);

      // Check if slot is blocked by trainer
      if (isSlotBlockedByTrainer(requestedMinutes, DEFAULT_DURATION, trainerBlocks)) {
        return new Response(JSON.stringify({ error: 'Slot is blocked by trainer' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Check if booker is trainer
      const { data: bookerRoles } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'trainer');
      const bookerIsTrainer = (bookerRoles && bookerRoles.length > 0);
      const maxAllowed = bookerIsTrainer ? MAX_CLIENTS_PER_SLOT : 1;

      if (currentCount >= maxAllowed) {
        return new Response(JSON.stringify({ error: 'Slot is not available' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Check balance — get active package with remaining sessions
      const pkg = await getActivePackageWithBalance(user.id);

      // If no balance and no pending payment flag, reject
      if (!pkg && !pendingPayment) {
        return new Response(JSON.stringify({ error: 'No active package with remaining sessions', requiresPayment: true }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create session (unique index prevents race condition — will throw on duplicate)
      const { data: session, error: insertError } = await supabase
        .from('scheduled_sessions')
        .insert({
          user_id: user.id,
          trainer_user_id: trainer.trainerId,
          session_date: date,
          session_time: time,
          is_recurring: false,
          package_id: pkg?.id || null, // link session to the package it will be billed to
          notes: pendingPayment ? `⏳ PENDING PAYMENT: ${selectedPackageSessions || '?'} sessions (${selectedPackagePrice || '?'}€)` : null,
        })
        .select()
        .single();

      if (insertError) {
        // Unique constraint violation = race condition or duplicate
        if (insertError.code === '23505') {
          return new Response(JSON.stringify({ error: 'Slot already taken' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        throw insertError;
      }

      // Deduct from package (only if has balance)
      let remaining: number | string = '?';
      if (pkg) {
        const newUsed = pkg.used_sessions + 1;
        const updates: Record<string, unknown> = { used_sessions: newUsed };
        if (newUsed >= pkg.total_sessions) {
          updates.is_active = false;
        }
        await supabase.from('client_packages')
          .update(updates)
          .eq('id', pkg.id)
          .eq('used_sessions', pkg.used_sessions); // optimistic lock

        // Write ledger entry
        await supabase.from('session_ledger').insert({
          user_id: user.id,
          package_id: pkg.id,
          delta: 1,
          reason: 'client_book',
          session_id: session.id,
          used_before: pkg.used_sessions,
          used_after: newUsed,
          idempotency_key: `client_book_${session.id}`,
        });

        remaining = pkg.total_sessions - newUsed;
      }

      // Get client profile for notifications
      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('full_name, telegram_chat_id')
        .eq('user_id', user.id)
        .single();

      const dateObj = new Date(date + 'T00:00:00');
      const dateStr = dateObj.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });

      // Send Telegram to trainer
      const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
      const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');
      const SITE_URL = 'https://my-fitness-coach-app.lovable.app';

      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        let trainerMsg = `📅 <b>Новая запись!</b>\n\n👤 ${escapeHtml(clientProfile?.full_name || 'Клиент')}\n📆 ${dateStr} в ${time}\n📦 Осталось: ${remaining} занятий`;

        // Alert trainer about pending payment
        if (pendingPayment) {
          trainerMsg += `\n\n💳 <b>⚠️ ОЖИДАЕТ ОПЛАТУ!</b>\nВыбрано: ${selectedPackageSessions || '?'} занятий (${selectedPackagePrice || '?'}€)\nОплата через Revolut — проверьте поступление!`;
        }

        await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, trainerMsg);

        // Send to client with cancel button
        if (clientProfile?.telegram_chat_id) {
          let clientMsg = `✅ <b>Запись подтверждена!</b>\n\n📆 ${dateStr} в ${time}\n📍 Eleftherias 119, Limassol`;
          if (pendingPayment) {
            clientMsg += `\n\n💳 Не забудьте оплатить: ${selectedPackagePrice || '?'}€`;
          }
          clientMsg += `\n\nДо встречи! 💪`;
          const cancelUrl = `${SITE_URL}/?cancel_session=${session.id}`;
          await sendTelegramWithButton(TELEGRAM_BOT_TOKEN, clientProfile.telegram_chat_id, clientMsg, '❌ Отменить запись', cancelUrl);
        }
      }

      return new Response(JSON.stringify({ success: true, session_id: session.id, pendingPayment: !!pendingPayment }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === CANCEL A SESSION ===
    if (action === 'cancel') {
      const user = await getAuthUser();
      if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { session_id } = body;
      if (!session_id) {
        return new Response(JSON.stringify({ error: 'session_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: session } = await supabase
        .from('scheduled_sessions')
        .select('*')
        .eq('id', session_id)
        .eq('user_id', user.id)
        .single();

      if (!session) {
        return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Check 24h rule using Cyprus timezone
      const sessionDateTime = new Date(session.session_date + 'T' + (session.session_time || '00:00') + ':00');
      const cyprusNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Nicosia' }));
      const hoursUntil = (sessionDateTime.getTime() - cyprusNow.getTime()) / (1000 * 60 * 60);
      if (hoursUntil < 24) {
        return new Response(JSON.stringify({ error: 'Cannot cancel less than 24 hours before session' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Delete session
      await supabase.from('scheduled_sessions').delete().eq('id', session_id);

      // Restore package balance (only for non-pending-payment sessions)
      const isPendingPayment = session.notes?.includes('PENDING PAYMENT');
      if (!session.is_recurring && !isPendingPayment) {
        // Priority: use the exact package linked to this session
        let target = null;
        if (session.package_id) {
          const { data: linkedPkg } = await supabase
            .from('client_packages')
            .select('*')
            .eq('id', session.package_id)
            .maybeSingle();
          if (linkedPkg && linkedPkg.used_sessions > 0) target = linkedPkg;
        }

        // Fallback: any package with used > 0
        if (!target) {
          const { data: pkgs } = await supabase
            .from('client_packages')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: true })
            .limit(5);
          target = pkgs?.find(p => p.is_active && p.used_sessions > 0)
            || pkgs?.find(p => p.used_sessions > 0) || null;
        }

        if (target) {
          const newUsed = target.used_sessions - 1;
          const updates: any = { used_sessions: newUsed };
          if (!target.is_active && newUsed < target.total_sessions) {
            updates.is_active = true;
          }
          await supabase.from('client_packages')
            .update(updates)
            .eq('id', target.id)
            .eq('used_sessions', target.used_sessions); // optimistic lock

          // Write ledger entry
          await supabase.from('session_ledger').insert({
            user_id: user.id,
            package_id: target.id,
            delta: -1,
            reason: 'client_cancel',
            session_id: session_id,
            used_before: target.used_sessions,
            used_after: newUsed,
            idempotency_key: `client_cancel_${session_id}`,
          });
        }
      }

      // Get client profile
      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('full_name, telegram_chat_id')
        .eq('user_id', user.id)
        .single();

      const dateObj = new Date(session.session_date + 'T00:00:00');
      const dateStr = dateObj.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
      const timeStr = session.session_time?.slice(0, 5) || '';

      const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
      const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
          `❌ <b>Отмена записи</b>\n\n👤 ${escapeHtml(clientProfile?.full_name || 'Клиент')}\n📆 ${dateStr} ${timeStr ? 'в ' + timeStr : ''}`
        );

        if (clientProfile?.telegram_chat_id) {
          await sendTelegram(TELEGRAM_BOT_TOKEN, clientProfile.telegram_chat_id,
            `❌ <b>Запись отменена</b>\n\n📆 ${dateStr} ${timeStr ? 'в ' + timeStr : ''}\n\nЗанятие возвращено на баланс.`
          );
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === GET MY SESSIONS ===
    if (action === 'mySessions') {
      const user = await getAuthUser();
      if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: mySessions } = await supabase
        .from('scheduled_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_recurring', false)
        .gte('session_date', new Date().toISOString().split('T')[0])
        .order('session_date', { ascending: true });

      return new Response(JSON.stringify({ sessions: mySessions || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in book-session:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function sendTelegram(token: string, chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  if (!res.ok) {
    const data = await res.json();
    console.error('Telegram error:', data);
  }
}

async function sendTelegramWithButton(token: string, chatId: string, text: string, buttonText: string, buttonUrl: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: buttonText, url: buttonUrl }]],
      },
    }),
  });
  if (!res.ok) {
    const data = await res.json();
    console.error('Telegram error:', data);
  }
}
