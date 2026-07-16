import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { Database } from "@/integrations/supabase/types";

export function supabaseForUser(ctx: ToolContext) {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

export async function isTrainer(ctx: ToolContext): Promise<boolean> {
  const supabase = supabaseForUser(ctx);
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.getUserId())
    .eq("role", "trainer")
    .maybeSingle();
  if (error) {
    console.error("isTrainer error:", error);
    return false;
  }
  return !!data;
}

export function requireAuth(ctx: ToolContext): boolean {
  if (!ctx.isAuthenticated()) {
    return false;
  }
  return true;
}

export function notAuthenticatedResponse() {
  return {
    content: [
      { type: "text" as const, text: "Not authenticated. Please complete OAuth sign-in." },
    ],
    isError: true,
  };
}

export function forbiddenResponse() {
  return {
    content: [
      { type: "text" as const, text: "You do not have permission to access this data." },
    ],
    isError: true,
  };
}
