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

    // Helper: get the newest valid package with remaining sessions (checks expiry)
    const getActivePackageWithBalance = async (userId: string) => {
      const { data: pkgs } = await supabase
        .from('client_packages')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

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
...
        // Fallback: newest package with used > 0
        if (!target) {
          const { data: pkgs } = await supabase
            .from('client_packages')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
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
