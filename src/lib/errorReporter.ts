import { supabase } from "@/integrations/supabase/client";

const sentRecently = new Map<string, number>();
const DEDUP_MS = 5 * 60 * 1000;

// Сетевой шум: обрыв связи, закрытая вкладка, блокировщики — не баги приложения
const NETWORK_NOISE = [
  "failed to fetch",
  "load failed",
  "networkerror",
  "network request failed",
  "the operation was aborted",
  "aborterror",
  "the network connection was lost",
  "importing a module script failed",
  "failed to fetch dynamically imported module",
  "cancelled",
  "отменено",
];

const IGNORE = ["resizeobserver loop", ...NETWORK_NOISE];

export async function reportClientError(input: {
  message: string;
  stack?: string;
  source?: string;
  /** true — клиент реально увидел ошибку на экране: шлём алерт даже при сетевом шуме */
  userVisible?: boolean;
}) {
  try {
    const message = (input.message || "").slice(0, 500);
    if (!message) return;
    const lower = message.toLowerCase();
    if (!input.userVisible && IGNORE.some((p) => lower.includes(p))) return;
    // Оффлайн — любая ошибка почти наверняка следствие потери связи
    if (!input.userVisible && typeof navigator !== "undefined" && navigator.onLine === false) return;

    const key = `${input.source || "app"}|${message}`;
    const now = Date.now();
    const last = sentRecently.get(key);
    if (last && now - last < DEDUP_MS) return;
    sentRecently.set(key, now);


    let user_id = "";
    let user_name = "";
    try {
      const { data } = await supabase.auth.getSession();
      user_id = data.session?.user?.id ?? "";
      user_name =
        (data.session?.user?.user_metadata?.full_name as string) ||
        data.session?.user?.email ||
        "";
    } catch {
      /* not authenticated */
    }

    await supabase.functions.invoke("report-client-error", {
      body: {
        message,
        stack: input.stack?.slice(0, 900),
        source: input.source || "app",
        url: window.location.href,
        route: window.location.pathname,
        user_id,
        user_name,
        user_agent: navigator.userAgent.slice(0, 200),
        online: navigator.onLine,
        user_visible: !!input.userVisible,
        occurred_at: new Date().toISOString(),

      },
    });
  } catch {
    /* never let reporting break the app */
  }
}

let installed = false;

export function installGlobalErrorReporting() {
  if (installed) return;
  installed = true;

  window.addEventListener("error", (event) => {
    reportClientError({
      message: event.message || String(event.error ?? "Unknown error"),
      stack: (event.error as Error | undefined)?.stack,
      source: "window.onerror",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as unknown;
    reportClientError({
      message:
        reason instanceof Error ? reason.message : String(reason ?? "Unhandled rejection"),
      stack: reason instanceof Error ? reason.stack : undefined,
      source: "unhandledrejection",
    });
  });
}
