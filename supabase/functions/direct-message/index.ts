import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyTrainer, sha256 } from "../_shared/directChat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "chat-files";
const MAX_BYTES = 10 * 1024 * 1024;

// deno-lint-ignore no-explicit-any
async function floodOk(admin: any, senderId: string) {
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await admin.from("direct_messages").select("id", { count: "exact", head: true })
    .eq("sender_user_id", senderId).gte("created_at", since);
  return (count ?? 0) < 30;
}

type File = { data: string; name: string; type: string };
function parseFile(f: unknown): File | null | "bad" {
  if (!f) return null;
  const o = f as Record<string, unknown>;
  if (typeof o.data !== "string" || typeof o.name !== "string" || typeof o.type !== "string") return "bad";
  if (o.data.length > Math.ceil(MAX_BYTES * 4 / 3) + 8) return "bad";
  return { data: o.data, name: o.name.slice(0, 120), type: o.type.slice(0, 100) };
}

// deno-lint-ignore no-explicit-any
async function uploadFile(admin: any, trainerId: string, chatId: string, f: File) {
  const bin = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
  if (bin.byteLength > MAX_BYTES) throw new Error("too big");
  const safe = f.name.replace(/[^\w.\-]+/g, "_").slice(-80) || "file";
  const path = `${trainerId}/${chatId}/${crypto.randomUUID()}-${safe}`;
  const { error } = await admin.storage.from(BUCKET).upload(path, bin, { contentType: f.type || "application/octet-stream" });
  if (error) throw error;
  return { attachment_path: path, attachment_name: f.name, attachment_type: f.type };
}

// deno-lint-ignore no-explicit-any
async function withUrls(admin: any, msgs: any[]) {
  return Promise.all(msgs.map(async (m) => {
    if (!m.attachment_path) return m;
    const { data } = await admin.storage.from(BUCKET).createSignedUrl(m.attachment_path, 3600);
    return { ...m, attachment_url: data?.signedUrl ?? null };
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "send";
    const file = parseFile(body.file);
    if (file === "bad") return json({ error: "File too large (max 10 MB)" }, 400);
    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (text.length > 2000) return json({ error: "Message too long" }, 400);

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
        const { data } = await admin.from("direct_messages").select("*")
          .eq("client_user_id", g.id).order("created_at").limit(500);
        await admin.from("direct_messages").update({ read_at: new Date().toISOString() })
          .eq("client_user_id", g.id).is("read_at", null).neq("sender_user_id", g.id);
        return json({ messages: await withUrls(admin, data || []), me: g.id, name: g.guest_name, closed: !!g.closed_at });
      }

      if (action === "guest_send") {
        if (g.closed_at) return json({ error: "Chat closed", closed: true }, 409);
        if (!text && !file) return json({ error: "Empty message" }, 400);
        if (!(await floodOk(admin, g.id))) return json({ error: "Too many messages" }, 429);
        const att = file ? await uploadFile(admin, g.trainer_user_id, g.id, file) : {};
        const { data: msg, error } = await admin.from("direct_messages").insert({
          client_user_id: g.id, trainer_user_id: g.trainer_user_id, sender_user_id: g.id, body: text, is_guest: true, ...att,
        }).select().single();
        if (error) { console.error(error); return json({ error: "Could not save message" }, 500); }
        await notifyTrainer(admin, msg, g.guest_name, true);
        return json({ message: (await withUrls(admin, [msg]))[0] });
      }
      return json({ error: "Unknown action" }, 400);
    }

    /* ───────── Trainer ───────── */
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: isTrainerRow } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "trainer").maybeSingle();
    if (!isTrainerRow) return json({ error: "Chat is available for new visitors only" }, 403);

    const chatId = body.client_user_id;
    if (typeof chatId !== "string" || !uuidRe.test(chatId)) return json({ error: "Invalid chat" }, 400);
    const { data: g } = await admin.from("guest_chats").select("id, trainer_user_id, closed_at").eq("id", chatId).maybeSingle();
    if (!g) return json({ error: "Chat not found" }, 404);
    if (g.trainer_user_id !== user.id) return json({ error: "Forbidden" }, 403);

    if (action === "close") {
      if (!g.closed_at) {
        await admin.from("guest_chats").update({ closed_at: new Date().toISOString() }).eq("id", g.id);
        await admin.from("direct_messages").insert({
          client_user_id: g.id, trainer_user_id: user.id, sender_user_id: user.id, is_guest: true, is_system: true,
          body: "Диалог завершён. Спасибо за обращение! · Chat closed. Thank you for reaching out!",
        });
      }
      return json({ ok: true });
    }

    if (g.closed_at) return json({ error: "Chat closed" }, 409);
    if (!text && !file) return json({ error: "Empty message" }, 400);
    if (!(await floodOk(admin, user.id))) return json({ error: "Too many messages, try again later" }, 429);
    const att = file ? await uploadFile(admin, user.id, g.id, file) : {};
    const { data: msg, error } = await admin.from("direct_messages").insert({
      client_user_id: g.id, trainer_user_id: user.id, sender_user_id: user.id, body: text, is_guest: true, ...att,
    }).select().single();
    if (error) { console.error("insert failed", error); return json({ error: "Could not save message" }, 500); }
    return json({ message: (await withUrls(admin, [msg]))[0] });
  } catch (e) {
    console.error(e);
    return json({ error: "Internal error" }, 500);
  }
});
