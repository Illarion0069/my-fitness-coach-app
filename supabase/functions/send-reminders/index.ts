import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Get Cyprus date/time components */
function getCyprusNow() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Nicosia',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
  const hour = parseInt(get('hour'));
  const minute = parseInt(get('minute'));
  return { dateStr, hour, minute, dayOfWeek: new Date(`${dateStr}T${get('hour')}:${get('minute')}:00`).getDay() };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { dateStr, hour, minute, dayOfWeek } = getCyprusNow();
    console.log(`[send-reminders] Cyprus: ${dateStr} ${hour}:${minute}, dow=${dayOfWeek}`);

    // Get all sessions for today
    // One-off sessions
    const { data: oneOff } = await supabase
      .from('scheduled_sessions')
      .select('*, profiles!scheduled_sessions_user_id_fkey(full_name, telegram_chat_id)')
      .eq('session_date', dateStr)
      .eq('is_recurring', false);

    // Recurring sessions for today's day
    const { data: recurring } = await supabase
      .from('scheduled_sessions')
      .select('*, profiles!scheduled_sessions_user_id_fkey(full_name, telegram_chat_id)')
      .eq('is_recurring', true)
      .eq('recurrence_day', dayOfWeek);

    // Filter recurring exceptions
    const filteredRecurring = (recurring || []).filter(s =>
      !s.recurring_exceptions?.includes(dateStr)
    );

    const allSessions = [...(oneOff || []), ...filteredRecurring];
    let sent = 0;

    for (const session of allSessions) {
      try {
        const sessionTime = session.session_time || session.recurrence_time;
        if (!sessionTime) continue;

        const [sHour, sMinute] = sessionTime.split(':').map(Number);
        const sessionMinutes = sHour * 60 + sMinute;
        const currentMinutes = hour * 60 + minute;
        const diff = sessionMinutes - currentMinutes; // minutes until session

        // Send 1h reminder (50-70 min before)
        if (diff < 50 || diff > 70) continue;

        // Get profile via join or separate query
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, telegram_chat_id')
          .eq('user_id', session.user_id)
          .maybeSingle();

        if (!profile?.telegram_chat_id) continue;

        const timeFormatted = `${String(sHour).padStart(2, '0')}:${String(sMinute).padStart(2, '0')}`;
        const msg = `⏰ <b>Reminder!</b>\n\nYour training session is in <b>1 hour</b> at <b>${timeFormatted}</b>.\n\n💪 Get ready!`;

        await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: profile.telegram_chat_id,
            text: msg,
            parse_mode: 'HTML',
          }),
        });

        sent++;
        console.log(`  ✓ Sent 1h reminder to ${profile.full_name}`);
      } catch (e) {
        console.error(`  ✗ Error for session ${session.id}:`, e);
      }
    }

    const result = { success: true, date: dateStr, hour, sent };
    console.log(`[send-reminders] Done:`, JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[send-reminders] Fatal:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
