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
  name: "list_body_measurements",
  title: "List body measurements",
  description:
    "List body measurements for a client. Trainers may query their clients; clients may only query themselves.",
  inputSchema: {
    client_user_id: z
      .string()
      .uuid()
      .optional()
      .describe("User ID of the client. Omit to query the signed-in user's own measurements."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum measurements to return (1-100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ client_user_id, limit = 20 }, ctx) => {
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
        .from("body_measurements")
        .select("id")
        .eq("trainer_user_id", userId)
        .eq("user_id", targetUserId)
        .limit(1);
      if (checkError || !checkData || checkData.length === 0) {
        return forbiddenResponse();
      }
    }

    const { data, error } = await supabase
      .from("body_measurements")
      .select("*")
      .eq("user_id", targetUserId)
      .order("measured_at", { ascending: false })
      .limit(limit);

    if (error) {
      return {
        content: [{ type: "text" as const, text: `Error listing body measurements: ${error.message}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ body_measurements: data ?? [] }) }],
      structuredContent: { body_measurements: data ?? [] },
    };
  },
});
