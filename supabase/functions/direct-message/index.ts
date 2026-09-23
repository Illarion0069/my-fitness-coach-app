import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyClient, notifyTrainer, sha256 } from "../_shared/directChat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// deno-lint-ignore no-explicit-any
async function floodOk(admin: any, senderId: string) {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await admin.from("direct_messages").select("id", { count: "exact", head: true })
    .eq("sender_user_id", senderId).gte("created_at", since);
  return (count ?? 0) < 30;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "send";

    /* ───────── Guest (no account) ───────── */
    if (action.startsWith("guest_")) {
      if (action === "guest_start") {
        const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
        if (!name) return json({ error: "Name required" }, 400);
        const { data: tr } = await admin.from("user_roles").select("user_id").eq("role", "trainer").order("id").limit(1).maybeSingle();
        if (!tr) return json({ error: "Trainer not found" }, 404);
        const token = crypto.randomUUID() + crypto.randomUUID();
        const { data: g, error } = await admin.from("guest_chats")
          .insert({ token_hash: await sha256(token), guest_name: name, trainer_user_id: tr.user_id })
          .select("id").single();
        if (error) { console.error(error); return json({ error: "Could not start chat" }, 500); }
        return json({ token, chat_id: g.id });
      }

      const token = typeof body.token === "string" ? body.token : "";
      if (token.length < 30 || token.length > 100) return json({ error: "Unauthorized" }, 401);
      const { data: g } = await admin.from("guest_chats").select("*").eq("token_hash", await sha256(token)).maybeSingle();
      if (!g) return json({ error: "Unauthorized" }, 401);

      if (action === "guest_list") {
        const { data } = await admin.from("direct_messages").select("id, sender_user_id, body, read_at, created_at, client_user_id")
          .eq("client_user_id", g.id).order("created_at").limit(500);
        await admin.from("direct_messages").update({ read_at: new Date().toISOString() })
          .eq("client_user_id", g.id).is("read_at", null).neq("sender_user_id", g.id);
        return json({ messages: data || [], me: g.id, name: g.guest_name });
      }

      if (action === "guest_send") {
        const text = typeof body.body === "string" ? body.body.trim() : "";
        if (!text || text.length > 2000) return json({ error: "Message must be 1–2000 characters" }, 400);
        if (!(await floodOk(admin, g.id))) return json({ error: "Too many messages" }, 429);
        const { data: msg, error } = await admin.from("direct_messages").insert({
          client_user_id: g.id, trainer_user_id: g.trainer_user_id, sender_user_id: g.id, body: text, is_guest: true,
        }).select().single();
        if (error) { console.error(error); return json({ error: "Could not save message" }, 500); }
        await notifyTrainer(admin, msg, g.guest_name, true);
        return json({ message: msg });
      }
      return json({ error: "Unknown action" }, 400);
    }

    /* ───────── Signed-in users ───────── */
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!text || text.length > 2000) return json({ error: "Message must be 1–2000 characters" }, 400);

    const { data: isTrainerRow } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "trainer").maybeSingle();

    let clientId: string, trainerId: string, isGuest = false, clientName = "Клиент";
    if (isTrainerRow && body.client_user_id) {
      if (!uuidRe.test(body.client_user_id)) return json({ error: "Invalid client" }, 400);
      const { data: cp } = await admin.from("profiles").select("user_id, trainer_user_id").eq("user_id", body.client_user_id).maybeSingle();
      if (cp) {
        if (cp.trainer_user_id && cp.trainer_user_id !== user.id) return json({ error: "Forbidden" }, 403);
        clientId = cp.user_id;
      } else {
        const { data: g } = await admin.from("guest_chats").select("id, trainer_user_id").eq("id", body.client_user_id).maybeSingle();
        if (!g) return json({ error: "Client not found" }, 404);
        if (g.trainer_user_id !== user.id) return json({ error: "Forbidden" }, 403);
        clientId = g.id; isGuest = true;
      }
      trainerId = user.id;
    } else {
      const { data: me } = await admin.from("profiles").select("trainer_user_id, full_name").eq("user_id", user.id).maybeSingle();
      let t = me?.trainer_user_id as string | null;
      if (!t) {
        const { data: tr } = await admin.from("user_roles").select("user_id").eq("role", "trainer").order("id").limit(1).maybeSingle();
        t = tr?.user_id ?? null;
      }
      if (!t) return json({ error: "Trainer not found" }, 404);
      clientId = user.id; trainerId = t; clientName = me?.full_name || clientName;
    }

    if (!(await floodOk(admin, user.id))) return json({ error: "Too many messages, try again later" }, 429);

    const { data: msg, error } = await admin.from("direct_messages").insert({
      client_user_id: clientId, trainer_user_id: trainerId, sender_user_id: user.id, body: text, is_guest: isGuest,
    }).select().single();
    if (error) { console.error("insert failed", error); return json({ error: "Could not save message" }, 500); }

    if (user.id === clientId) await notifyTrainer(admin, msg, clientName, false);
    else await notifyClient(admin, clientId, isGuest, text);

    return json({ message: msg });
  } catch (e) {
    console.error(e);
    return json({ error: "Internal error" }, 500);
  }
});
