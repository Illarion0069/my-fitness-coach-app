import { supabase } from "@/integrations/supabase/client";

const ANON_KEY = "app_anon_id";

function getAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

function getDevice(): string {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/iPhone|Android|Mobile/i.test(ua)) return "mobile";
  return "desktop";
}

let cachedUserId: string | null | undefined;

async function currentUserId(): Promise<string | null> {
  if (cachedUserId !== undefined) return cachedUserId;
  try {
    const { data } = await supabase.auth.getSession();
    cachedUserId = data.session?.user?.id ?? null;
  } catch {
    cachedUserId = null;
  }
  return cachedUserId;
}

supabase.auth.onAuthStateChange((_e, session) => {
  cachedUserId = session?.user?.id ?? null;
});

// Небольшая защита от спама одинаковыми событиями
const lastSent = new Map<string, number>();
const DEDUP_MS = 1500;

export async function trackEvent(
  eventType: "screen" | "click" | "funnel",
  label: string,
  props: Record<string, unknown> = {},
) {
  const clean = label.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!clean) return;

  const key = `${eventType}|${clean}`;
  const now = Date.now();
  const prev = lastSent.get(key);
  if (prev && now - prev < DEDUP_MS) return;
  lastSent.set(key, now);

  try {
    await supabase.from("app_events").insert({
      user_id: await currentUserId(),
      anon_id: getAnonId(),
      event_type: eventType,
      label: clean,
      path: window.location.pathname + window.location.hash,
      device: getDevice(),
      props: props as never,
    });
  } catch {
    // аналитика никогда не должна ломать приложение
  }
}

export function trackFunnel(step: string, props: Record<string, unknown> = {}) {
  void trackEvent("funnel", step, props);
}

export function trackScreen(name: string) {
  void trackEvent("screen", name);
}

function labelForElement(el: HTMLElement): string | null {
  const explicit = el.closest<HTMLElement>("[data-track]")?.dataset.track;
  if (explicit) return explicit;

  const target = el.closest<HTMLElement>(
    "button, a, [role='button'], [role='tab'], [role='menuitem']",
  );
  if (!target) return null;

  const aria = target.getAttribute("aria-label");
  const text = (aria || target.innerText || target.getAttribute("title") || "").trim();
  if (!text) return null;
  return text.split("\n")[0];
}

let installed = false;

export function installClickTracking() {
  if (installed) return;
  installed = true;

  document.addEventListener(
    "click",
    (e) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      const label = labelForElement(el);
      if (label) void trackEvent("click", label);
    },
    { capture: true },
  );

  const sendScreen = () => trackScreen(window.location.pathname + (window.location.hash || ""));
  sendScreen();
  window.addEventListener("hashchange", sendScreen);
  window.addEventListener("popstate", sendScreen);
}
