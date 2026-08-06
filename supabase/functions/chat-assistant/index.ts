import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTHROPIC_API_KEY = (Deno.env.get('ANTHROPIC_API_KEY') ?? '').replace(/[^\x21-\x7e]/g, '');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;

const SYSTEM_PROMPT = `You are the booking assistant for Limassol Fitness, a personal training studio in Limassol, Cyprus run by trainer Illarion Ientin (certified EQF 3 & 4). Reply in the same language the user writes in (English or Russian).

Services & pricing:
- Consultation (1h, first visit): 50€ — measurements, health check, plan
- Single session: 100€
- 8-session package: 750€ (~94€/session)
- 12-session package: 1030€ (~86€/session)
- 20-session package: 1599€ (~80€/session)
- Gym membership: 150€/month, paid separately from training packages

Formats: HIIT, TRX, strength training, stretching, in a private gym.

Policies:
- Working days: Monday–Friday only, no weekend sessions
- One training session per client per day (extra sessions only by direct arrangement — direct the user to WhatsApp/Telegram for that)
- Free cancellation up to 24 hours before a session; after that it's deducted from the package
- Payment is via Revolut, handled inside the app's booking flow — you do not process payment yourself
- All times are Cyprus time (Asia/Nicosia)

You can check open slots and create bookings using the tools provided. Always call get_available_slots before booking to confirm the time is actually free. If the user is not logged in, collect their name and phone number before calling book_session. Never invent availability — always call the tool. Keep answers short and friendly. If a question is outside what you know (medical concerns, complaints, complex conflicts), say you'll pass it to Illarion directly and suggest WhatsApp/Telegram.`;

const TOOLS = [
  {
    name: 'get_available_slots',
    description: 'Get available training time slots for a specific date.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
      },
      required: ['date'],
    },
  },
  {
    name: 'book_session',
    description:
      'Book a training session for the given date and time. For guests (not logged in), guest_name and guest_phone are required.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        time: { type: 'string', description: 'Time in HH:MM format, e.g. 18:00' },
        guest_name: { type: 'string', description: 'Required only if the user is not logged in' },
        guest_phone: {
          type: 'string',
          description: 'Required only if not logged in, include country code, e.g. +35799123456',
        },
      },
      required: ['date', 'time'],
    },
  },
  {
    name: 'cancel_session',
    description: "Cancel one of the logged-in user's upcoming sessions by id. Only works for logged-in users.",
    input_schema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
      },
      required: ['session_id'],
    },
  },
];

async function callBookSession(action: string, params: Record<string, unknown>, authHeader: string | null) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/book-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify({ action, ...params }),
  });
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { messages } = await req.json();
    const authHeader = req.headers.get('Authorization');
    const conversation = [...messages];
    let finalText = '';

    for (let turn = 0; turn < 5; turn++) {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: TOOLS,
          messages: conversation,
        }),
      });

      const data = await resp.json();
      if (data.error) {
        return new Response(JSON.stringify({ error: data.error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const toolUses = (data.content || []).filter((b: any) => b.type === 'tool_use');
      const textBlocks = (data.content || []).filter((b: any) => b.type === 'text');
      finalText = textBlocks.map((b: any) => b.text).join('\n');

      if (toolUses.length === 0) break;

      conversation.push({ role: 'assistant', content: data.content });

      const toolResults = [];
      for (const tool of toolUses) {
        let result;
        if (tool.name === 'get_available_slots') {
          result = await callBookSession('getSlots', { date: tool.input.date }, authHeader);
        } else if (tool.name === 'book_session') {
          const action = authHeader ? 'book' : 'guestBook';
          const params = authHeader
            ? { date: tool.input.date, time: tool.input.time }
            : {
                date: tool.input.date,
                time: tool.input.time,
                guest_name: tool.input.guest_name,
                guest_phone: tool.input.guest_phone,
              };
          result = await callBookSession(action, params, authHeader);
        } else if (tool.name === 'cancel_session') {
          result = await callBookSession('cancel', { session_id: tool.input.session_id }, authHeader);
        } else {
          result = { error: 'Unknown tool' };
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: JSON.stringify(result),
        });
      }
      conversation.push({ role: 'user', content: toolResults });
    }

    return new Response(JSON.stringify({ reply: finalText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
