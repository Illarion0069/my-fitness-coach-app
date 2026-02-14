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

    // Helper: authenticate user (only for actions that need it)
    const authHeader = req.headers.get('Authorization');
    const getAuthUser = async () => {
      if (!authHeader?.startsWith('Bearer ')) return null;
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await authClient.auth.getUser();
      return user;
    };

    // Helper: parse "HH:MM" to minutes since midnight
    const timeToMinutes = (t: string): number => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + (m || 0);
    };

    // Helper: check if a new slot overlaps with any booked session (using per-session durations)
    const isSlotBlocked = (slotStart: number, slotDuration: number, bookedSessions: { start: number; duration: number }[]): boolean => {
      const slotEnd = slotStart + slotDuration;
      for (const booked of bookedSessions) {
        const bookedEnd = booked.start + booked.duration;
        // Overlap: slotStart < bookedEnd AND bookedStart < slotEnd
        if (slotStart < bookedEnd && booked.start < slotEnd) {
          return true;
        }
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

      const dayOfWeek = new Date(date + 'T12:00:00').getDay();

      // Find trainer
      const { data: trainers } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'trainer')
        .limit(1);
      const trainerId = trainers?.[0]?.user_id;

      // Get trainer working hours
      let workStart = 7;
      let workEnd = 19;
      let daysOff: number[] = [0]; // Sunday by default
      if (trainerId) {
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
      }

      // If it's a day off, return empty slots
      if (daysOff.includes(dayOfWeek)) {
        return new Response(JSON.stringify({ slots: [], sessionDuration: DEFAULT_DURATION, dayOff: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get all sessions for this date (one-off) and recurring for this day
      const { data: oneOff } = await supabase
        .from('scheduled_sessions')
        .select('session_time, duration_minutes')
        .eq('session_date', date)
        .eq('is_recurring', false);

      const { data: recurring } = await supabase
        .from('scheduled_sessions')
        .select('recurrence_time, duration_minutes')
        .eq('is_recurring', true)
        .eq('recurrence_day', dayOfWeek);

      const bookedSessions: { start: number; duration: number }[] = [];
      (oneOff || []).forEach(s => { if (s.session_time) bookedSessions.push({ start: timeToMinutes(s.session_time.slice(0, 5)), duration: s.duration_minutes || DEFAULT_DURATION }); });
      (recurring || []).forEach(s => { if (s.recurrence_time) bookedSessions.push({ start: timeToMinutes(s.recurrence_time.slice(0, 5)), duration: s.duration_minutes || DEFAULT_DURATION }); });

      // Generate hourly slots within working hours
      const slots: { time: string; available: boolean }[] = [];
      for (let h = workStart; h <= workEnd; h++) {
        const timeStr = `${String(h).padStart(2, '0')}:00`;
        const slotMinutes = h * 60;
        slots.push({ time: timeStr, available: !isSlotBlocked(slotMinutes, DEFAULT_DURATION, bookedSessions) });
      }

      return new Response(JSON.stringify({ slots, sessionDuration: DEFAULT_DURATION }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === BOOK A SESSION ===
    if (action === 'book') {
      const user = await getAuthUser();
      if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { date, time } = body;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return new Response(JSON.stringify({ error: 'Invalid date' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!time || !/^\d{2}:\d{2}$/.test(time)) {
        return new Response(JSON.stringify({ error: 'Invalid time' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate time is within valid range (00-23 hours)
      const bookHour = parseInt(time.split(':')[0]);
      const bookMinute = parseInt(time.split(':')[1]);
      if (bookHour < 0 || bookHour > 23 || bookMinute < 0 || bookMinute > 59) {
        return new Response(JSON.stringify({ error: 'Time out of valid range' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check the date is not in the past
      const bookingDate = new Date(date + 'T' + time + ':00');
      if (bookingDate < new Date()) {
        return new Response(JSON.stringify({ error: 'Cannot book in the past' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate time is within trainer's working hours
      const dayOfWeek = new Date(date + 'T12:00:00').getDay();

      // Find trainer
      const { data: trainersList } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'trainer')
        .limit(1);
      const trainerId = trainersList?.[0]?.user_id;

      let workStart = 7;
      let workEnd = 19;
      let daysOff: number[] = [0];
      if (trainerId) {
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
      }

      if (daysOff.includes(dayOfWeek)) {
        return new Response(JSON.stringify({ error: 'Cannot book on a day off' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (bookHour < workStart || bookHour >= workEnd) {
        return new Response(JSON.stringify({ error: 'Time outside working hours' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check slot not already taken (with duration overlap)
      const { data: existingOneOff } = await supabase
        .from('scheduled_sessions')
        .select('session_time, duration_minutes')
        .eq('session_date', date)
        .eq('is_recurring', false);

      // dayOfWeek already computed above
      const { data: existingRecurring } = await supabase
        .from('scheduled_sessions')
        .select('recurrence_time, duration_minutes')
        .eq('is_recurring', true)
        .eq('recurrence_day', dayOfWeek);

      const bookedSessions: { start: number; duration: number }[] = [];
      (existingOneOff || []).forEach(s => { if (s.session_time) bookedSessions.push({ start: timeToMinutes(s.session_time.slice(0, 5)), duration: s.duration_minutes || DEFAULT_DURATION }); });
      (existingRecurring || []).forEach(s => { if (s.recurrence_time) bookedSessions.push({ start: timeToMinutes(s.recurrence_time.slice(0, 5)), duration: s.duration_minutes || DEFAULT_DURATION }); });

      const requestedMinutes = timeToMinutes(time);
      if (isSlotBlocked(requestedMinutes, DEFAULT_DURATION, bookedSessions)) {
        return new Response(JSON.stringify({ error: 'Slot overlaps with existing session' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // trainerId already resolved above
      if (!trainerId) {
        return new Response(JSON.stringify({ error: 'No trainer found' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create session
      const { data: session, error: insertError } = await supabase
        .from('scheduled_sessions')
        .insert({
          user_id: user.id,
          trainer_user_id: trainerId,
          session_date: date,
          session_time: time,
          is_recurring: false,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Deduct from active package
      const { data: pkgs } = await supabase
        .from('client_packages')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1);

      const pkg = pkgs?.[0];
      if (pkg && pkg.used_sessions < pkg.total_sessions) {
        await supabase
          .from('client_packages')
          .update({ used_sessions: pkg.used_sessions + 1 })
          .eq('id', pkg.id);
      }

      // Get client profile for notifications
      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('full_name, telegram_chat_id')
        .eq('user_id', user.id)
        .single();

      const dateObj = new Date(date + 'T00:00:00');
      const dateStr = dateObj.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
      const remaining = pkg ? pkg.total_sessions - pkg.used_sessions - 1 : '?';

      // Send Telegram to trainer
      const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
      const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        const trainerMsg = `📅 <b>Новая запись!</b>\n\n👤 ${clientProfile?.full_name || 'Клиент'}\n📆 ${dateStr} в ${time}\n📦 Осталось: ${remaining} занятий`;
        await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, trainerMsg);

        // Send to client if they have telegram
        if (clientProfile?.telegram_chat_id) {
          const clientMsg = `✅ <b>Запись подтверждена!</b>\n\n📆 ${dateStr} в ${time}\n📍 Eleftherias 119, Limassol\n\nДо встречи! 💪`;
          await sendTelegram(TELEGRAM_BOT_TOKEN, clientProfile.telegram_chat_id, clientMsg);
        }
      }

      return new Response(JSON.stringify({ success: true, session_id: session.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === CANCEL A SESSION ===
    if (action === 'cancel') {
      const user = await getAuthUser();
      if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { session_id } = body;
      if (!session_id) {
        return new Response(JSON.stringify({ error: 'session_id required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get the session
      const { data: session } = await supabase
        .from('scheduled_sessions')
        .select('*')
        .eq('id', session_id)
        .eq('user_id', user.id)
        .single();

      if (!session) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check 24h rule
      const sessionDateTime = new Date(session.session_date + 'T' + (session.session_time || '00:00') + ':00');
      const hoursUntil = (sessionDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntil < 24) {
        return new Response(JSON.stringify({ error: 'Cannot cancel less than 24 hours before session' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Delete session
      await supabase.from('scheduled_sessions').delete().eq('id', session_id);

      // Restore package balance
      if (!session.is_recurring) {
        const { data: pkgs } = await supabase
          .from('client_packages')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1);
        const pkg = pkgs?.[0];
        if (pkg && pkg.used_sessions > 0) {
          await supabase
            .from('client_packages')
            .update({ used_sessions: pkg.used_sessions - 1 })
            .eq('id', pkg.id);
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

      // Notify trainer
      const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
      const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
          `❌ <b>Отмена записи</b>\n\n👤 ${clientProfile?.full_name || 'Клиент'}\n📆 ${dateStr} ${timeStr ? 'в ' + timeStr : ''}`
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
