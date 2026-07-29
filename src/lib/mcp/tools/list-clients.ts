import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  supabaseForUser,
  isTrainer,
  requireAuth,
  notAuthenticatedResponse,
} from "./_shared";

export default defineTool({
  name: "list_clients",
  title: "List clients",
  description:
    "List clients accessible to the signed-in user. Trainers see all clients they work with; clients see their own profile.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum number of clients to return (1-100)."),
    search: z
      .string()
      .max(100)
      .optional()
      .describe("Optional name or email substring to filter clients."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit = 50, search }, ctx) => {
    if (!requireAuth(ctx)) return notAuthenticatedResponse();
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const trainer = await isTrainer(ctx);

    let clientUserIds: string[] = [];

    if (trainer) {
      // Find distinct user IDs the trainer has worked with across tables that carry trainer_user_id.
      const tables = [
        { table: "scheduled_sessions", column: "user_id" },
        { table: "body_measurements", column: "user_id" },
      ] as const;

      for (const { table, column } of tables) {
        const { data, error } = await supabase
          .from(table)
          .select(column)
          .eq("trainer_user_id", userId);
        if (error) {
          console.error(`list_clients: error reading ${table}:`, error);
          continue;
        }
        for (const row of data || []) {
          const value = (row as Record<string, unknown>)[column];
          if (typeof value === "string" && !clientUserIds.includes(value)) {
            clientUserIds.push(value);
          }
        }
      }
    } else {
      clientUserIds = [userId];
    }

    if (clientUserIds.length === 0) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ clients: [] }) }],
        structuredContent: { clients: [] },
      };
    }

    let query = supabase
      .from("profiles")
      .select("id, user_id, full_name, email, phone, avatar_url, archived_at, nutrition_goal, daily_calorie_goal")
      .in("user_id", clientUserIds)
      .order("full_name", { ascending: true });

    if (search?.trim()) {
      const term = search.trim().toLowerCase();
      query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
    }

    const { data, error } = await query.limit(limit);
    if (error) {
      return {
        content: [{ type: "text" as const, text: `Error listing clients: ${error.message}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ clients: data ?? [] }) }],
      structuredContent: { clients: data ?? [] },
    };
  },
});
