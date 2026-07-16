import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  supabaseForUser,
  isTrainer,
  requireAuth,
  notAuthenticatedResponse,
  forbiddenResponse,
} from "./_shared";

export default defineTool({
  name: "list_nutrition_logs",
  title: "List nutrition logs",
  description:
    "List nutrition diary entries for a client. Trainers may query their clients; clients may only query themselves.",
  inputSchema: {
    client_user_id: z
      .string()
      .uuid()
      .optional()
      .describe("User ID of the client. Omit to query the signed-in user's own logs."),
    from_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Start date in YYYY-MM-DD format."),
    to_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("End date in YYYY-MM-DD format."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe("Maximum logs to return (1-200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ client_user_id, from_date, to_date, limit = 30 }, ctx) => {
    if (!requireAuth(ctx)) return notAuthenticatedResponse();
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const trainer = await isTrainer(ctx);
    const targetUserId = client_user_id ?? userId;

    if (!trainer && targetUserId !== userId) {
      return forbiddenResponse();
    }

    if (trainer) {
      const { data: checkData, error: checkError } = await supabase
        .from("scheduled_sessions")
        .select("id")
        .eq("trainer_user_id", userId)
        .eq("user_id", targetUserId)
        .limit(1);
      if (checkError || !checkData || checkData.length === 0) {
        return forbiddenResponse();
      }
    }

    let query = supabase
      .from("nutrition_logs")
      .select("*")
      .eq("user_id", targetUserId)
      .order("log_date", { ascending: false });

    if (from_date) query = query.gte("log_date", from_date);
    if (to_date) query = query.lte("log_date", to_date);

    const { data, error } = await query.limit(limit);
    if (error) {
      return {
        content: [{ type: "text" as const, text: `Error listing nutrition logs: ${error.message}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ nutrition_logs: data ?? [] }) }],
      structuredContent: { nutrition_logs: data ?? [] },
    };
  },
});
