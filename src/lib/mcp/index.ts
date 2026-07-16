import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listClientsTool from "./tools/list-clients";
import listSessionsTool from "./tools/list-sessions";
import getClientSummaryTool from "./tools/get-client-summary";
import listNutritionLogsTool from "./tools/list-nutrition-logs";
import listBodyMeasurementsTool from "./tools/list-body-measurements";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "limassol-fitness-mcp",
  title: "Limassol Fitness",
  version: "0.1.0",
  instructions:
    "Read-only access to the Limassol Fitness trainer dashboard. Trainers can list their clients, view scheduled sessions, and read client summaries including packages, nutrition, body measurements, and achievements. Clients can read only their own data. All access is scoped by Supabase RLS and user roles.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listClientsTool,
    listSessionsTool,
    getClientSummaryTool,
    listNutritionLogsTool,
    listBodyMeasurementsTool,
  ],
});
