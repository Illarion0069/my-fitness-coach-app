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
  name: "get_client_summary",
  title: "Get client summary",
  description:
    "Return a summary of a client: profile, active packages, recent sessions, body measurements, nutrition streak/achievements, and latest test result. Trainers may query their clients; clients may only query themselves.",
  inputSchema: {
    client_user_id: z
      .string()
      .uuid()
      .describe("User ID of the client to summarize."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ client_user_id }, ctx) => {
    if (!requireAuth(ctx)) return notAuthenticatedResponse();
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const trainer = await isTrainer(ctx);

    if (!trainer && client_user_id !== userId) {
      return forbiddenResponse();
    }

    if (trainer) {
      const { data: checkData, error: checkError } = await supabase
        .from("scheduled_sessions")
        .select("id")
        .eq("trainer_user_id", userId)
        .eq("user_id", client_user_id)
        .limit(1);
      if (checkError || !checkData || checkData.length === 0) {
        return forbiddenResponse();
      }
    }

    const [
      profileRes,
      packagesRes,
      sessionsRes,
      measurementsRes,
      nutritionRes,
      achievementsRes,
      testsRes,
    ] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", client_user_id).maybeSingle(),
      supabase
        .from("client_packages")
        .select("*")
        .eq("user_id", client_user_id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("scheduled_sessions")
        .select("id, session_date, session_time, duration_minutes, is_deducted, notes")
        .eq("user_id", client_user_id)
        .order("session_date", { ascending: false })
        .limit(10),
      supabase
        .from("body_measurements")
        .select("*")
        .eq("user_id", client_user_id)
        .order("measured_at", { ascending: false })
        .limit(5),
      supabase
        .from("nutrition_logs")
        .select("log_date, ai_score, ai_feedback, water_ml, alcohol_ml, coffee_cups, tea_cups, notes")
        .eq("user_id", client_user_id)
        .order("log_date", { ascending: false })
        .limit(7),
      supabase
        .from("client_achievements")
        .select("achievement_key, title_en, title_ru, earned_at")
        .eq("user_id", client_user_id)
        .order("earned_at", { ascending: false })
        .limit(10),
      supabase
        .from("test_results")
        .select("*")
        .eq("user_id", client_user_id)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    const summary = {
      profile: profileRes.data ?? null,
      packages: packagesRes.data ?? [],
      recent_sessions: sessionsRes.data ?? [],
      recent_measurements: measurementsRes.data ?? [],
      recent_nutrition: nutritionRes.data ?? [],
      recent_achievements: achievementsRes.data ?? [],
      latest_test: testsRes.data?.[0] ?? null,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(summary) }],
      structuredContent: summary,
    };
  },
});
