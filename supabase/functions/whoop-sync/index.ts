import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function refreshTokenIfNeeded(supabaseAdmin: any, tokenRow: any, clientId: string, clientSecret: string) {
  if (new Date(tokenRow.expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return tokenRow.access_token; // Still valid
  }

  // Refresh the token
  const res = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenRow.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Token refresh failed:', res.status, errText);
    // Delete invalid tokens so user can re-connect
    await supabaseAdmin.from('whoop_tokens').delete().eq('user_id', tokenRow.user_id);
    throw new Error('Token refresh failed');
  }

  const tokens = await res.json();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const updatePayload: Record<string, unknown> = {
    access_token: tokens.access_token,
    expires_at: expiresAt,
  };
  // Only update refresh_token if Whoop returned a new one
  if (tokens.refresh_token) {
    updatePayload.refresh_token = tokens.refresh_token;
  }

  await supabaseAdmin.from('whoop_tokens').update(updatePayload).eq('user_id', tokenRow.user_id);

  return tokens.access_token;
}

async function fetchWhoopData(accessToken: string, endpoint: string, params?: Record<string, string>) {
  const url = new URL(`https://api.prod.whoop.com/developer/v1/${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    console.error(`Whoop API ${endpoint} error:`, res.status, t);
    return null;
  }
  return await res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const WHOOP_CLIENT_ID = Deno.env.get('WHOOP_CLIENT_ID')!;
    const WHOOP_CLIENT_SECRET = Deno.env.get('WHOOP_CLIENT_SECRET')!;

    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claimsData.claims.sub;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user's Whoop tokens
    const { data: tokenRow } = await supabaseAdmin
      .from('whoop_tokens')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!tokenRow) {
      return new Response(JSON.stringify({ error: 'Whoop not connected', connected: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If refresh_token is missing, token can't be refreshed — check if still valid
    if (!tokenRow.refresh_token && new Date(tokenRow.expires_at) <= new Date(Date.now() + 5 * 60 * 1000)) {
      console.error('Token expired and no refresh_token available');
      await supabaseAdmin.from('whoop_tokens').delete().eq('user_id', userId);
      return new Response(JSON.stringify({ error: 'Whoop token expired', connected: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let accessToken: string;
    try {
      accessToken = await refreshTokenIfNeeded(supabaseAdmin, tokenRow, WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET);
    } catch (e) {
      console.error('Failed to refresh Whoop token:', e);
      return new Response(JSON.stringify({ error: 'Whoop token expired', connected: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch last 7 days of data
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startDate = weekAgo.toISOString();
    const endDate = now.toISOString();

    const [cyclesData, workoutsData, recoveryData, sleepData] = await Promise.all([
      fetchWhoopData(accessToken, 'cycle', { start: startDate, end: endDate, limit: '25' }),
      fetchWhoopData(accessToken, 'workout', { start: startDate, end: endDate, limit: '25' }),
      fetchWhoopData(accessToken, 'recovery', { start: startDate, end: endDate, limit: '25' }),
      fetchWhoopData(accessToken, 'sleep', { start: startDate, end: endDate, limit: '25' }),
    ]);

    // Aggregate by date
    const metricsByDate: Record<string, any> = {};

    // Process cycles (strain, calories, avg HR)
    if (cyclesData?.records) {
      for (const cycle of cyclesData.records) {
        const date = cycle.start?.slice(0, 10);
        if (!date) continue;
        if (!metricsByDate[date]) metricsByDate[date] = {};
        metricsByDate[date].strain = cycle.score?.strain;
        metricsByDate[date].calories = cycle.score?.kilojoule ? Math.round(cycle.score.kilojoule * 0.239006) : null;
        metricsByDate[date].avg_heart_rate = cycle.score?.average_heart_rate;
        metricsByDate[date].max_heart_rate = cycle.score?.max_heart_rate;
      }
    }

    // Process recovery (recovery score, HRV, resting HR)
    if (recoveryData?.records) {
      for (const rec of recoveryData.records) {
        const date = rec.created_at?.slice(0, 10) || rec.cycle?.start?.slice(0, 10);
        if (!date) continue;
        if (!metricsByDate[date]) metricsByDate[date] = {};
        metricsByDate[date].recovery_score = rec.score?.recovery_score;
        metricsByDate[date].hrv = rec.score?.hrv_rmssd_milli;
        metricsByDate[date].resting_heart_rate = rec.score?.resting_heart_rate;
      }
    }

    // Process sleep
    if (sleepData?.records) {
      for (const s of sleepData.records) {
        const date = s.start?.slice(0, 10);
        if (!date) continue;
        if (!metricsByDate[date]) metricsByDate[date] = {};
        if (s.score?.stage_summary) {
          const total = s.score.stage_summary.total_in_bed_time_milli;
          if (total) metricsByDate[date].sleep_duration_minutes = Math.round(total / 60000);
        }
      }
    }

    // Process workouts (count per day)
    if (workoutsData?.records) {
      for (const w of workoutsData.records) {
        const date = w.start?.slice(0, 10);
        if (!date) continue;
        if (!metricsByDate[date]) metricsByDate[date] = {};
        metricsByDate[date].workout_count = (metricsByDate[date].workout_count || 0) + 1;
      }
    }

    // Upsert metrics
    const upserts = Object.entries(metricsByDate).map(([date, metrics]: [string, any]) => ({
      user_id: userId,
      metric_date: date,
      ...metrics,
      raw_data: { cycles: cyclesData?.records?.length || 0, workouts: workoutsData?.records?.length || 0 },
    }));

    if (upserts.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from('whoop_metrics')
        .upsert(upserts, { onConflict: 'user_id,metric_date' });
      if (upsertError) console.error('Metrics upsert error:', upsertError);
    }

    // Return latest metrics for display
    const { data: latestMetrics } = await supabaseAdmin
      .from('whoop_metrics')
      .select('*')
      .eq('user_id', userId)
      .order('metric_date', { ascending: false })
      .limit(7);

    return new Response(JSON.stringify({ connected: true, metrics: latestMetrics || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('whoop-sync error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
