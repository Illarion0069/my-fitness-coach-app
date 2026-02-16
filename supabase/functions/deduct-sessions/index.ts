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
    // Authenticate: only allow calls with valid user JWT (trainer role) or service-level auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify the caller is a trainer
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const roleClient = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await roleClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'trainer')
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden: trainer role required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    console.log(`Running deduction for ${todayStr}, day of week: ${dayOfWeek}`);

    // 1. Find one-off sessions scheduled for today that haven't been deducted
    const { data: oneOffSessions } = await supabase
      .from('scheduled_sessions')
      .select('*')
      .eq('session_date', todayStr)
      .eq('is_recurring', false)
      .eq('is_deducted', false);

    // 2. Find recurring sessions for today's day of week
    const { data: recurringSessions } = await supabase
      .from('scheduled_sessions')
      .select('*')
      .eq('is_recurring', true)
      .eq('recurrence_day', dayOfWeek);

    // For recurring, check if already deducted today or if today is in exceptions
    const recurringToDeduct = (recurringSessions || []).filter(s => {
      // Skip if today's date is in recurring_exceptions
      if (s.recurring_exceptions && s.recurring_exceptions.includes(todayStr)) {
        console.log(`Session ${s.id} has exception for ${todayStr}, skipping`);
        return false;
      }
      if (!s.deducted_at) return true;
      const lastDeducted = new Date(s.deducted_at).toISOString().split('T')[0];
      return lastDeducted !== todayStr;
    });

    const allToDeduct = [...(oneOffSessions || []), ...recurringToDeduct];
    console.log(`Sessions to deduct: ${allToDeduct.length}`);

    let deducted = 0;

    for (const session of allToDeduct) {
      // Find active package for this user
      const { data: packages } = await supabase
        .from('client_packages')
        .select('*')
        .eq('user_id', session.user_id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1);

      const pkg = packages?.[0];
      if (!pkg) {
        console.log(`No active package for user ${session.user_id}, skipping`);
        continue;
      }

      if (pkg.used_sessions >= pkg.total_sessions) {
        console.log(`Package ${pkg.id} fully used for user ${session.user_id}, skipping`);
        continue;
      }

      // Deduct one session
      await supabase
        .from('client_packages')
        .update({ used_sessions: pkg.used_sessions + 1 })
        .eq('id', pkg.id);

      // Mark session as deducted
      await supabase
        .from('scheduled_sessions')
        .update({
          is_deducted: !session.is_recurring, // only mark one-off as permanently deducted
          deducted_at: new Date().toISOString(),
          package_id: pkg.id,
        })
        .eq('id', session.id);

      deducted++;
      console.log(`Deducted session for user ${session.user_id} from package ${pkg.id}`);
    }

    return new Response(
      JSON.stringify({ success: true, date: todayStr, total: allToDeduct.length, deducted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in deduct-sessions:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
