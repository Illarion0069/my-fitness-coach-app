import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listClientsTool from "./tools/list-clients";
import listSessionsTool from "./tools/list-sessions";
import getClientSummaryTool from "./tools/get-client-summary";
import listNutritionLogsTool from "./tools/list-nutrition-logs";
import listBodyMeasurementsTool from "./tools/list-body-measurements";
import getAvailableSlotsTool from "./tools/get-available-slots";
import bookClientSessionTool from "./tools/book-client-session";
import cancelSessionTool from "./tools/cancel-session";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "limassol-fitness-mcp",
  title: "Limassol Fitness",
  version: "0.2.0",
  instructions:
    "Access to the Limassol Fitness trainer dashboard. Trainers can list their clients, view scheduled sessions, read client summaries (packages, nutrition, body measurements, achievements), check available slots, book sessions for clients, and cancel sessions. Clients can read and manage only their own data. All access is scoped by Supabase RLS and user roles.",
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
    getAvailableSlotsTool,
    bookClientSessionTool,
    cancelSessionTool,
  ],
});
