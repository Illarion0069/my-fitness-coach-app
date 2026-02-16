import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encrypt } from "../_shared/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, code, redirect_uri } = await req.json();
    const WHOOP_CLIENT_ID = Deno.env.get('WHOOP_CLIENT_ID');
    const WHOOP_CLIENT_SECRET = Deno.env.get('WHOOP_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!WHOOP_CLIENT_ID || !WHOOP_CLIENT_SECRET) {
      throw new Error('Whoop credentials not configured');
    }

    // Verify the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claimsData.claims.sub;

    if (action === 'get_auth_url') {
      const scopes = 'read:recovery read:cycles read:workout read:body_measurement read:profile read:sleep offline';
      console.log('whoop-auth: redirect_uri received =', redirect_uri);
      const authUrl = `https://api.prod.whoop.com/oauth/oauth2/auth?client_id=${WHOOP_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${userId}`;
      return new Response(JSON.stringify({ url: authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'exchange_code') {
      const tokenRes = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri,
          client_id: WHOOP_CLIENT_ID,
          client_secret: WHOOP_CLIENT_SECRET,
        }),
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        console.error('Whoop token exchange failed:', tokenRes.status, errText);
        return new Response(JSON.stringify({ error: 'Token exchange failed' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokens = await tokenRes.json();
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Encrypt tokens before storing
      const encryptedAccessToken = await encrypt(tokens.access_token);

      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const upsertPayload: Record<string, unknown> = {
        user_id: userId,
        access_token: encryptedAccessToken,
        expires_at: expiresAt,
        scopes: tokens.scope || '',
      };
      if (tokens.refresh_token) {
        upsertPayload.refresh_token = await encrypt(tokens.refresh_token);
      }
      const { error: upsertError } = await supabaseAdmin
        .from('whoop_tokens')
        .upsert(upsertPayload, { onConflict: 'user_id' });

      if (upsertError) {
        console.error('Failed to store tokens:', upsertError);
        return new Response(JSON.stringify({ error: 'Failed to store tokens' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('whoop-auth error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
