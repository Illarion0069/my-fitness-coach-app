import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, notAuthenticatedResponse } from "./_shared";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineTool({
  name: "cancel_session",
  title: "Cancel a session",
  description:
    "Cancel a scheduled session by id. Trainers may cancel any of their clients' sessions; clients may cancel only their own (enforced server-side by the book-session function).",
  inputSchema: {
    session_id: z.string().uuid().describe("ID of the session to cancel."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ session_id }, ctx) => {
    if (!requireAuth(ctx)) return notAuthenticatedResponse();
    const res = await fetch(`https://${projectRef}.supabase.co/functions/v1/book-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.getToken()}` },
      body: JSON.stringify({ action: "cancel", session_id }),
    });
    const data = await res.json();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data) }],
      structuredContent: data,
      isError: !!data.error,
    };
  },
});
