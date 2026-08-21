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

/* ------------------------------------------------------------------ */
/* Breadcrumbs — короткая история действий перед падением              */
/* ------------------------------------------------------------------ */

type Crumb = { t: string; kind: string; text: string };
const crumbs: Crumb[] = [];
const MAX_CRUMBS = 25;

export function addBreadcrumb(kind: string, text: string) {
  if (!text) return;
  crumbs.push({
    t: new Date().toISOString().slice(11, 19),
    kind,
    text: String(text).slice(0, 120),
  });
  if (crumbs.length > MAX_CRUMBS) crumbs.shift();
}

function crumbsText() {
  return crumbs.map((c) => `${c.t} [${c.kind}] ${c.text}`).join("\n").slice(0, 900);
}

/** Версия сборки — чтобы понимать, на какой версии упало */
const RELEASE =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_APP_RELEASE ||
  (typeof document !== "undefined" ? document.documentElement.dataset.build : "") ||
  "dev";

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
        release: RELEASE,
        breadcrumbs: crumbsText(),
        viewport: `${window.innerWidth}x${window.innerHeight}`,
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

  addBreadcrumb("nav", window.location.pathname);

  window.addEventListener("error", (event) => {
    // Ошибки загрузки ресурсов (картинки, скрипты, чанки) приходят без message
    const target = event.target as (HTMLElement & { src?: string; href?: string }) | null;
    if (target && target !== (window as unknown as HTMLElement) && (target.src || target.href)) {
      addBreadcrumb("resource", `failed to load ${target.src || target.href}`);
      reportClientError({
        message: `Не загрузился ресурс: ${(target.src || target.href || "").slice(0, 200)}`,
        source: "resource-error",
      });
      return;
    }
    reportClientError({
      message: event.message || String(event.error ?? "Unknown error"),
      stack: (event.error as Error | undefined)?.stack,
      source: "window.onerror",
    });
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as unknown;
    reportClientError({
      message:
        reason instanceof Error ? reason.message : String(reason ?? "Unhandled rejection"),
      stack: reason instanceof Error ? reason.stack : undefined,
      source: "unhandledrejection",
    });
  });

  // console.error — «тихие» падения, которые не долетают до window.onerror
  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    origError(...args);
    try {
      const err = args.find((a) => a instanceof Error) as Error | undefined;
      const text = args
        .map((a) => (a instanceof Error ? a.message : typeof a === "string" ? a : safeJson(a)))
        .join(" ")
        .slice(0, 300);
      addBreadcrumb("console.error", text);
      if (!text) return;
      // React-предупреждения и dev-шум в алерты не тащим
      if (/^warning:|prop type|deprecat|react-router future flag/i.test(text)) return;
      reportClientError({ message: text, stack: err?.stack, source: "console.error" });
    } catch {
      /* ignore */
    }
  };

  // Хлебные крошки: переходы и клики
  const pushState = history.pushState.bind(history);
  history.pushState = ((...args: Parameters<typeof history.pushState>) => {
    const r = pushState(...args);
    addBreadcrumb("nav", window.location.pathname);
    return r;
  }) as typeof history.pushState;
  window.addEventListener("popstate", () => addBreadcrumb("nav", window.location.pathname));

  document.addEventListener(
    "click",
    (e) => {
      const el = (e.target as HTMLElement | null)?.closest("button,a,[role=button]") as HTMLElement | null;
      if (el) addBreadcrumb("click", el.getAttribute("aria-label") || el.innerText || el.tagName);
    },
    true
  );

  window.addEventListener("offline", () => addBreadcrumb("net", "offline"));
  window.addEventListener("online", () => addBreadcrumb("net", "online"));
}

function safeJson(v: unknown) {
  try {
    return JSON.stringify(v)?.slice(0, 120) ?? "";
  } catch {
    return "";
  }
}
