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
  const touchMac = /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1; // iPadOS masquerades as Mac
  if (/iPad/i.test(ua) || touchMac) return "ipad";
  if (/iPhone|iPod/i.test(ua)) return "iphone";
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? "android" : "android-tablet";
  if (/Tablet/i.test(ua)) return "tablet";
  if (/Mobile/i.test(ua)) return "mobile";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  if (/Windows/i.test(ua)) return "windows";
  if (/Linux/i.test(ua)) return "linux";
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

// --- Источник перехода (referrer + UTM), фиксируется один раз на сессию ---
const REF_KEY = "app_referrer";

function categorizeSource(raw: string | null, utmSource: string | null): string | null {
  if (utmSource) return utmSource.toLowerCase();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.origin === window.location.origin) return null; // внутренний переход
    const h = u.hostname.toLowerCase();
    if (h.includes("google") && (u.pathname.startsWith("/maps") || h.includes("maps"))) return "Google Maps";
    if (h.includes("google")) return "Google";
    if (h.includes("yandex")) return "Yandex";
    if (h.includes("instagram") || h.includes("l.instagram")) return "Instagram";
    if (h.includes("facebook") || h.includes("fb.com") || h.includes("l.facebook")) return "Facebook";
    if (h.includes("t.me") || h.includes("telegram")) return "Telegram";
    if (h.includes("wa.me") || h.includes("whatsapp")) return "WhatsApp";
    if (h.includes("tiktok")) return "TikTok";
    return h.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function getReferrer(): string | null {
  try {
    const cached = sessionStorage.getItem(REF_KEY);
    if (cached !== null) return cached || null;

    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get("utm_source");
    const source = categorizeSource(document.referrer, utmSource);
    const value = source || "Прямой заход";
    sessionStorage.setItem(REF_KEY, value);
    return value;
  } catch {
    return null;
  }
}

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
