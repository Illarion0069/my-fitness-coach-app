import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { isTrainer, requireAuth, notAuthenticatedResponse, forbiddenResponse } from "./_shared";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineTool({
  name: "book_client_session",
  title: "Book a session for a client",
  description: "Book a training session for a specific client. Trainer only.",
  inputSchema: {
    client_user_id: z.string().uuid().describe("User ID of the client to book for."),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date in YYYY-MM-DD format."),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional().describe("Time in HH:MM format."),
  },
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ client_user_id, date, time }, ctx) => {
    if (!requireAuth(ctx)) return notAuthenticatedResponse();
    if (!(await isTrainer(ctx))) return forbiddenResponse();
    const res = await fetch(`https://${projectRef}.supabase.co/functions/v1/book-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.getToken()}` },
      body: JSON.stringify({ action: "trainerBook", client_user_id, date, time }),
    });
    const data = await res.json();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data) }],
      structuredContent: data,
      isError: !!data.error,
    };
  },
});
