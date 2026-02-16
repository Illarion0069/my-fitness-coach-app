import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decrypt, encrypt, isEncrypted } from "../_shared/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function decryptToken(value: string): Promise<string> {
  return isEncrypted(value) ? await decrypt(value) : value;
}

async function refreshToken(tokenRow: any, clientId: string, clientSecret: string) {
  if (new Date(tokenRow.expires_at) > new Date(Date.now() + 5 * 60 * 1000)) {
    return await decryptToken(tokenRow.access_token);
  }
  const refreshTokenValue = await decryptToken(tokenRow.refresh_token);
  const res = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshTokenValue,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    console.error(`Token refresh failed for ${tokenRow.user_id}:`, res.status, await res.text());
    return null;
  }
  const tokens = await res.json();
  return {
    access_token: tokens.access_token,
    encrypted_access_token: await encrypt(tokens.access_token),
    refresh_token: tokens.refresh_token ? await encrypt(tokens.refresh_token) : undefined,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  };
}

async function fetchWhoopData(accessToken: string, endpoint: string, params?: Record<string, string>) {
  const url = new URL(`https://api.prod.whoop.com/developer/v1/${endpoint}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) { await res.text(); return null; }
  return await res.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const WHOOP_CLIENT_ID = Deno.env.get('WHOOP_CLIENT_ID')!;
    const WHOOP_CLIENT_SECRET = Deno.env.get('WHOOP_CLIENT_SECRET')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: allTokens, error: tokensError } = await supabase.from('whoop_tokens').select('*');
    if (tokensError || !allTokens?.length) {
      console.log('No Whoop tokens found or error:', tokensError);
      return new Response(JSON.stringify({ synced: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Syncing Whoop data for ${allTokens.length} users`);
    let synced = 0;

    for (const tokenRow of allTokens) {
      try {
        const refreshResult = await refreshToken(tokenRow, WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET);
        if (!refreshResult) continue;

        let accessToken: string;
        if (typeof refreshResult === 'string') {
          accessToken = refreshResult;
        } else {
          accessToken = refreshResult.access_token;
          const updatePayload: Record<string, unknown> = {
            access_token: refreshResult.encrypted_access_token,
            expires_at: refreshResult.expires_at,
          };
          if (refreshResult.refresh_token) {
            updatePayload.refresh_token = refreshResult.refresh_token;
          }
          await supabase.from('whoop_tokens').update(updatePayload).eq('user_id', tokenRow.user_id);
        }

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

        const metricsByDate: Record<string, any> = {};

        if (cyclesData?.records) {
          for (const c of cyclesData.records) {
            const d = c.start?.slice(0, 10); if (!d) continue;
            if (!metricsByDate[d]) metricsByDate[d] = {};
            metricsByDate[d].strain = c.score?.strain;
            metricsByDate[d].calories = c.score?.kilojoule ? Math.round(c.score.kilojoule * 0.239006) : null;
            metricsByDate[d].avg_heart_rate = c.score?.average_heart_rate;
            metricsByDate[d].max_heart_rate = c.score?.max_heart_rate;
          }
        }
        if (recoveryData?.records) {
          for (const r of recoveryData.records) {
            const d = r.created_at?.slice(0, 10) || r.cycle?.start?.slice(0, 10); if (!d) continue;
            if (!metricsByDate[d]) metricsByDate[d] = {};
            metricsByDate[d].recovery_score = r.score?.recovery_score;
            metricsByDate[d].hrv = r.score?.hrv_rmssd_milli;
            metricsByDate[d].resting_heart_rate = r.score?.resting_heart_rate;
          }
        }
        if (sleepData?.records) {
          for (const s of sleepData.records) {
            const d = s.start?.slice(0, 10); if (!d) continue;
            if (!metricsByDate[d]) metricsByDate[d] = {};
            if (s.score?.stage_summary?.total_in_bed_time_milli)
              metricsByDate[d].sleep_duration_minutes = Math.round(s.score.stage_summary.total_in_bed_time_milli / 60000);
          }
        }
        if (workoutsData?.records) {
          for (const w of workoutsData.records) {
            const d = w.start?.slice(0, 10); if (!d) continue;
            if (!metricsByDate[d]) metricsByDate[d] = {};
            metricsByDate[d].workout_count = (metricsByDate[d].workout_count || 0) + 1;
          }
        }

        const upserts = Object.entries(metricsByDate).map(([date, m]: [string, any]) => ({
          user_id: tokenRow.user_id, metric_date: date, ...m,
        }));

        if (upserts.length > 0) {
          await supabase.from('whoop_metrics').upsert(upserts, { onConflict: 'user_id,metric_date' });
        }

        synced++;
        console.log(`Synced ${upserts.length} days for user ${tokenRow.user_id}`);
      } catch (e) {
        console.error(`Error syncing user ${tokenRow.user_id}:`, e);
      }
    }

    return new Response(JSON.stringify({ synced, total: allTokens.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('whoop-cron error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
