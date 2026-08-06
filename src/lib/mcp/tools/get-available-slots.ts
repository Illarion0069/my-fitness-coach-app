import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, notAuthenticatedResponse } from "./_shared";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineTool({
  name: "get_available_slots",
  title: "Get available training slots",
  description: "Get available training time slots for a given date.",
  inputSchema: {
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Date in YYYY-MM-DD format."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date }, ctx) => {
    if (!requireAuth(ctx)) return notAuthenticatedResponse();
    const res = await fetch(`https://${projectRef}.supabase.co/functions/v1/book-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ctx.getToken()}` },
      body: JSON.stringify({ action: "getSlots", date }),
    });
    const data = await res.json();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data) }],
      structuredContent: data,
    };
  },
});
