import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const DEFAULT_DURATION = 60;
const MAX_CLIENTS_PER_SLOT = 2;

type PackageRow = {
  id: string;
  user_id: string;
  total_sessions: number;
  used_sessions: number;
  is_active: boolean;
  expires_at: string | null;
};

type SessionRow = {
  id: string;
  user_id: string;
  session_date: string;
  session_time: string | null;
  is_recurring: boolean;
  recurrence_day: number | null;
  recurrence_time: string | null;
  package_id: string | null;
  notes: string | null;
};

const timeToMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + (minutes || 0);
};

const countOverlapping = (
  slotStart: number,
  slotDuration: number,
  bookedSessions: { start: number; duration: number }[]
): number => {
  const slotEnd = slotStart + slotDuration;
  let count = 0;

  for (const booked of bookedSessions) {
    const bookedEnd = booked.start + booked.duration;
    if (slotStart < bookedEnd && booked.start < slotEnd) count += 1;
  }

  return count;
};

const isSlotBlocked = (
  slotStart: number,
  slotDuration: number,
  blocks: { start: number; duration: number }[]
): boolean => {
  const slotEnd = slotStart + slotDuration;
  return blocks.some((block) => {
    const blockEnd = block.start + block.duration;
    return slotStart < blockEnd && block.start < slotEnd;
  });
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
    const authHeader = req.headers.get('Authorization');

    const getAuthUser = async () => {
      if (!authHeader?.startsWith('Bearer ')) return null;
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await authClient.auth.getUser();
      return user;
    };

    const isTrainer = async (userId: string) => {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'trainer')
        .maybeSingle();
      return !!data;
    };

    const getTrainerInfo = async () => {
      const { data: trainers } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'trainer')
        .limit(1);

      const trainerId = trainers?.[0]?.user_id;
      if (!trainerId) return null;

      let workStart = 7;
      let workEnd = 19;
      let daysOff: number[] = [0];

      const { data: hours } = await supabase
        .from('trainer_working_hours')
        .select('work_start_hour, work_end_hour, days_off')
        .eq('trainer_user_id', trainerId)
        .maybeSingle();

      if (hours) {
        workStart = hours.work_start_hour;
        workEnd = hours.work_end_hour;
        daysOff = hours.days_off || [0];
      }

      return { trainerId, workStart, workEnd, daysOff };
    };

    const getLatestValidPackage = async (userId: string): Promise<PackageRow | null> => {
      const { data: packages } = await supabase
        .from('client_packages')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!packages) return null;

      for (const pkg of packages as PackageRow[]) {
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
    };

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

      const booked: { start: number; duration: number }[] = [];
      (oneOff || []).forEach((session) => {
        if (session.session_time) {
          booked.push({
            start: timeToMinutes(session.session_time.slice(0, 5)),
            duration: session.duration_minutes || DEFAULT_DURATION,
          });
        }
      });

      (recurring || []).forEach((session) => {
        if (session.recurring_exceptions?.includes(date)) return;
        if (session.recurrence_time) {
          booked.push({
            start: timeToMinutes(session.recurrence_time.slice(0, 5)),
            duration: session.duration_minutes || DEFAULT_DURATION,
          });
        }
      });

      return booked;
    };

    const getTrainerBlocks = async (date: string, dayOfWeek: number) => {
      const { data: oneOff } = await supabase
        .from('trainer_blocks')
        .select('block_time, duration_minutes')
        .eq('block_date', date)
        .eq('is_recurring', false);

      const { data: recurring } = await supabase
        .from('trainer_blocks')
        .select('block_time, duration_minutes, recurring_exceptions')
        .eq('is_recurring', true)
        .eq('recurrence_day', dayOfWeek);

      const blocks: { start: number; duration: number }[] = [];
      (oneOff || []).forEach((block) => {
        if (block.block_time) {
          blocks.push({
            start: timeToMinutes(block.block_time.slice(0, 5)),
            duration: block.duration_minutes || DEFAULT_DURATION,
          });
        }
      });

      (recurring || []).forEach((block) => {
        if (block.recurring_exceptions?.includes(date)) return;
        if (block.block_time) {
          blocks.push({
            start: timeToMinutes(block.block_time.slice(0, 5)),
            duration: block.duration_minutes || DEFAULT_DURATION,
          });
        }
      });

      return blocks;
    };

    if (action === 'getSlots') {
      const { date } = body;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return new Response(JSON.stringify({ error: 'Invalid date' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const forceClientView = body?.forceClientView === true;
      const requester = await getAuthUser();
      const trainerViewEnabled = requester ? (await isTrainer(requester.id)) && !forceClientView : false;
      const trainer = await getTrainerInfo();
      if (!trainer) {
        return new Response(JSON.stringify({ slots: [], sessionDuration: DEFAULT_DURATION }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
      if (trainer.daysOff.includes(dayOfWeek)) {
        return new Response(JSON.stringify({ slots: [], sessionDuration: DEFAULT_DURATION, dayOff: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const bookedSessions = await getBookedSessions(date, dayOfWeek);
      const trainerBlocks = await getTrainerBlocks(date, dayOfWeek);
      const cyprusNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Nicosia' }));
      const cyprusToday = `${cyprusNow.getFullYear()}-${String(cyprusNow.getMonth() + 1).padStart(2, '0')}-${String(cyprusNow.getDate()).padStart(2, '0')}`;
      const isToday = date === cyprusToday;
      const currentMinutes = isToday ? cyprusNow.getHours() * 60 + cyprusNow.getMinutes() : -1;

      const slots: { time: string; available: boolean; booked: number }[] = [];
      for (let hour = trainer.workStart; hour <= trainer.workEnd; hour += 1) {
        const time = `${String(hour).padStart(2, '0')}:00`;
        const slotMinutes = hour * 60;
        const bookedCount = countOverlapping(slotMinutes, DEFAULT_DURATION, bookedSessions);
        const blocked = isSlotBlocked(slotMinutes, DEFAULT_DURATION, trainerBlocks);
        const isPast = isToday && slotMinutes <= currentMinutes;
        const available = isPast
          ? false
          : trainerViewEnabled
            ? bookedCount < MAX_CLIENTS_PER_SLOT && !blocked
            : bookedCount === 0 && !blocked;

        slots.push({ time, available, booked: trainerViewEnabled ? bookedCount : 0 });
      }

      return new Response(JSON.stringify({
        slots,
        sessionDuration: DEFAULT_DURATION,
        maxPerSlot: trainerViewEnabled ? MAX_CLIENTS_PER_SLOT : 1,
        timezone: 'Asia/Nicosia',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'trainerBook') {
      console.log('[trainerBook] start', JSON.stringify(body));
      const user = await getAuthUser();
      if (!user || !(await isTrainer(user.id))) {
        console.log('[trainerBook] forbidden, user:', user?.id);
        return new Response(JSON.stringify({ error: 'Forbidden: trainer only' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { client_user_id, date, time } = body;
      if (!client_user_id || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (time && !/^\d{2}:\d{2}$/.test(time))) {
        return new Response(JSON.stringify({ error: 'Invalid booking payload' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const trainer = await getTrainerInfo();
      if (!trainer) {
        return new Response(JSON.stringify({ error: 'No trainer found' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (time) {
        const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
        const bookedSessions = await getBookedSessions(date, dayOfWeek);
        const trainerBlocks = await getTrainerBlocks(date, dayOfWeek);
        const requestedMinutes = timeToMinutes(time);

        if (isSlotBlocked(requestedMinutes, DEFAULT_DURATION, trainerBlocks)) {
          return new Response(JSON.stringify({ error: 'Slot is blocked by trainer' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (countOverlapping(requestedMinutes, DEFAULT_DURATION, bookedSessions) >= MAX_CLIENTS_PER_SLOT) {
          return new Response(JSON.stringify({ error: 'Slot is not available' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      const pkg = await getLatestValidPackage(client_user_id);
      console.log('[trainerBook] package for', client_user_id, pkg ? `id=${pkg.id} used=${pkg.used_sessions}/${pkg.total_sessions}` : 'NONE (no-package session)');

      const { data: createdSession, error: insertError } = await supabase
        .from('scheduled_sessions')
        .insert({
          user_id: client_user_id,
          trainer_user_id: trainer.trainerId,
          session_date: date,
          session_time: time,
          is_recurring: false,
          package_id: pkg?.id || null,
        })
        .select('id')
        .single();

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (pkg) {
        const newUsed = pkg.used_sessions + 1;
        const packageUpdates: Record<string, unknown> = { used_sessions: newUsed };
        if (newUsed >= pkg.total_sessions) {
          packageUpdates.is_active = false;
        }

        const { error: updateError } = await supabase
          .from('client_packages')
          .update(packageUpdates)
          .eq('id', pkg.id)
          .eq('used_sessions', pkg.used_sessions);

        if (updateError) {
          await supabase.from('scheduled_sessions').delete().eq('id', createdSession.id);
          return new Response(JSON.stringify({ error: 'Package update conflict, retry please' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        await supabase.from('session_ledger').insert({
          user_id: client_user_id,
          package_id: pkg.id,
          delta: 1,
          reason: 'trainer_book',
          session_id: createdSession.id,
          used_before: pkg.used_sessions,
          used_after: newUsed,
          idempotency_key: `trainer_book_${createdSession.id}`,
        });
      }

      return new Response(JSON.stringify({ success: true, session_id: createdSession.id, hasPackage: !!pkg }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'book') {
      const user = await getAuthUser();
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { date, time, pendingPayment, selectedPackageSessions, selectedPackagePrice } = body;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !time || !/^\d{2}:\d{2}$/.test(time)) {
        return new Response(JSON.stringify({ error: 'Invalid booking payload' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const trainer = await getTrainerInfo();
      if (!trainer) {
        return new Response(JSON.stringify({ error: 'No trainer found' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
      if (trainer.daysOff.includes(dayOfWeek)) {
        return new Response(JSON.stringify({ error: 'Cannot book on a day off' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const bookHour = Number(time.split(':')[0]);
      if (bookHour < trainer.workStart || bookHour >= trainer.workEnd) {
        return new Response(JSON.stringify({ error: 'Time outside working hours' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const bookedSessions = await getBookedSessions(date, dayOfWeek);
      const trainerBlocks = await getTrainerBlocks(date, dayOfWeek);
      const requestedMinutes = timeToMinutes(time);
      const requesterIsTrainer = await isTrainer(user.id);
      const maxAllowed = requesterIsTrainer ? MAX_CLIENTS_PER_SLOT : 1;

      if (isSlotBlocked(requestedMinutes, DEFAULT_DURATION, trainerBlocks)) {
        return new Response(JSON.stringify({ error: 'Slot is blocked by trainer' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (countOverlapping(requestedMinutes, DEFAULT_DURATION, bookedSessions) >= maxAllowed) {
        return new Response(JSON.stringify({ error: 'Slot is not available' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pkg = await getLatestValidPackage(user.id);
      if (!pkg && !pendingPayment) {
        return new Response(JSON.stringify({ error: 'No active package with remaining sessions', requiresPayment: true }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: session, error: insertError } = await supabase
        .from('scheduled_sessions')
        .insert({
          user_id: user.id,
          trainer_user_id: trainer.trainerId,
          session_date: date,
          session_time: time,
          is_recurring: false,
          package_id: pkg?.id || null,
          notes: pendingPayment ? `⏳ PENDING PAYMENT: ${selectedPackageSessions || '?'} sessions (${selectedPackagePrice || '?'}€)` : null,
        })
        .select('*')
        .single();

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (pkg) {
        const newUsed = pkg.used_sessions + 1;
        const updates: Record<string, unknown> = { used_sessions: newUsed };
        if (newUsed >= pkg.total_sessions) {
          updates.is_active = false;
        }

        await supabase
          .from('client_packages')
          .update(updates)
          .eq('id', pkg.id)
          .eq('used_sessions', pkg.used_sessions);

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
      }

      return new Response(JSON.stringify({ success: true, session_id: session.id, pendingPayment: !!pendingPayment }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'cancel') {
      const user = await getAuthUser();
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { session_id } = body;
      if (!session_id) {
        return new Response(JSON.stringify({ error: 'session_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: session } = await supabase
        .from('scheduled_sessions')
        .select('*')
        .eq('id', session_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!session) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase.from('scheduled_sessions').delete().eq('id', session_id);

      const isPendingPayment = session.notes?.includes('PENDING PAYMENT');
      if (!session.is_recurring && !isPendingPayment) {
        let target: PackageRow | null = null;

        if (session.package_id) {
          const { data: linkedPkg } = await supabase
            .from('client_packages')
            .select('*')
            .eq('id', session.package_id)
            .maybeSingle();
          if (linkedPkg && linkedPkg.used_sessions > 0) {
            target = linkedPkg as PackageRow;
          }
        }

        if (!target) {
          const { data: packages } = await supabase
            .from('client_packages')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);

          target = (packages as PackageRow[] | null)?.find((pkg) => pkg.is_active && pkg.used_sessions > 0)
            || (packages as PackageRow[] | null)?.find((pkg) => pkg.used_sessions > 0)
            || null;
        }

        if (target) {
          const newUsed = target.used_sessions - 1;
          const updates: Record<string, unknown> = { used_sessions: newUsed };
          if (!target.is_active && newUsed < target.total_sessions) {
            updates.is_active = true;
          }

          await supabase
            .from('client_packages')
            .update(updates)
            .eq('id', target.id)
            .eq('used_sessions', target.used_sessions);

          await supabase.from('session_ledger').insert({
            user_id: user.id,
            package_id: target.id,
            delta: -1,
            reason: 'client_cancel',
            session_id,
            used_before: target.used_sessions,
            used_after: newUsed,
            idempotency_key: `client_cancel_${session_id}`,
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'guestBook') {
      const { date, time, guest_name, guest_phone } = body;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !time || !/^\d{2}:\d{2}$/.test(time)) {
        return new Response(JSON.stringify({ error: 'Invalid booking payload' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!guest_name?.trim() || !guest_phone?.trim()) {
        return new Response(JSON.stringify({ error: 'Name and phone required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const trainer = await getTrainerInfo();
      if (!trainer) {
        return new Response(JSON.stringify({ error: 'No trainer found' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
      if (trainer.daysOff.includes(dayOfWeek)) {
        return new Response(JSON.stringify({ error: 'Cannot book on a day off' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const bookedSessions = await getBookedSessions(date, dayOfWeek);
      const trainerBlocks = await getTrainerBlocks(date, dayOfWeek);
      const requestedMinutes = timeToMinutes(time);

      if (isSlotBlocked(requestedMinutes, DEFAULT_DURATION, trainerBlocks)) {
        return new Response(JSON.stringify({ error: 'Slot is blocked' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (countOverlapping(requestedMinutes, DEFAULT_DURATION, bookedSessions) >= 1) {
        return new Response(JSON.stringify({ error: 'Slot is not available' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: insertError } = await supabase
        .from('guest_bookings')
        .insert({
          guest_name: guest_name.trim(),
          guest_phone: guest_phone.trim(),
          session_date: date,
          session_time: time,
          trainer_user_id: trainer.trainerId,
          status: 'pending',
        });

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Send Telegram notification to trainer
      try {
        const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
        const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
        if (telegramToken && chatId) {
          const dateFormatted = new Date(`${date}T12:00:00`).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
          const msg = `🆕 *Новая гостевая запись!*\n\n👤 ${guest_name.trim()}\n📞 ${guest_phone.trim()}\n📅 ${dateFormatted}\n🕐 ${time}\n\n⚠️ Клиент не зарегистрирован`;
          await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
          });
        }
      } catch (e) {
        console.error('Telegram notification failed:', e);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'mySessions') {
      const user = await getAuthUser();
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const today = new Date().toISOString().split('T')[0];
      const { data: sessions } = await supabase
        .from('scheduled_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_recurring', false)
        .gte('session_date', today)
        .order('session_date', { ascending: true });

      return new Response(JSON.stringify({ sessions: (sessions || []) as SessionRow[] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
