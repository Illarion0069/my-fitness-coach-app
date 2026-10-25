// Google Analytics 4 + Google Ads measurement with regional consent (Consent Mode v2).
// Rules: consent defaults to denied everywhere until we know the visitor's region.
// Visitors outside consent regions are granted measurement without a banner.
// Visitors in consent regions (EEA, UK, CH, etc.) see a banner; their choice is stored.

const MEASUREMENT_ID = import.meta.env
  .VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY as string | undefined;

// Regions where an explicit opt-in is required before ad/analytics storage.
const CONSENT_REGIONS = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE", "GB", "CH", "IS", "LI", "NO",
]);

const CONSENT_KEY = "ads_consent_v1";
const NOTICE_VERSION = "2026-10-25";

type ConsentChoice = "granted" | "denied";

interface ConsentRecord {
  choice: ConsentChoice;
  ts: string;
  version: string;
  region: string;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;
let bannerPending = false;
let bannerRequester: (() => void) | null = null;
let lastRegion = "XX";

function gtag(...args: unknown[]) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

function applyConsent(choice: ConsentChoice) {
  gtag("consent", "update", {
    ad_storage: choice,
    analytics_storage: choice,
    ad_user_data: choice,
    ad_personalization: choice,
  });
}

export function getConsentRecord(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    if (parsed.choice !== "granted" && parsed.choice !== "denied") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setAdsConsent(choice: ConsentChoice, region?: string) {
  const record: ConsentRecord = {
    choice,
    ts: new Date().toISOString(),
    version: NOTICE_VERSION,
    region: region ?? lastRegion,
  };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
  } catch {
    // private mode: still apply the choice for this visit
  }
  applyConsent(choice);
}

/** Register the banner component; fires immediately if the banner is already due. */
export function onConsentBannerNeeded(cb: () => void) {
  bannerRequester = cb;
  if (bannerPending) cb();
}

function requestBanner() {
  bannerPending = true;
  bannerRequester?.();
}

async function detectRegion(): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2000);
  try {
    const res = await fetch("/cdn-cgi/trace", { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return "XX";
    const text = await res.text();
    const loc = text.match(/^loc=(.+)$/m)?.[1]?.trim().toUpperCase();
    return loc || "XX";
  } catch {
    return "XX";
  } finally {
    clearTimeout(timer);
  }
}

export async function initGoogleAnalytics() {
  if (initialized || !MEASUREMENT_ID) return;
  initialized = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.gtag = gtag;
  gtag("js", new Date());
  // Deny by default until the region/choice is known.
  gtag("consent", "default", {
    ad_storage: "denied",
    analytics_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500,
  });
  gtag("config", MEASUREMENT_ID);

  // SPA navigation: this app switches sections via hash, count those as page views.
  window.addEventListener("hashchange", () => {
    gtag("event", "page_view", { page_path: window.location.pathname + window.location.hash });
  });

  const saved = getConsentRecord();
  if (saved) {
    lastRegion = saved.region;
    applyConsent(saved.choice);
    return;
  }

  const region = await detectRegion();
  lastRegion = region;

  // Unknown (XX) or Tor (T1): treat as a consent region and ask.
  if (region !== "XX" && region !== "T1" && !CONSENT_REGIONS.has(region)) {
    setAdsConsent("granted", region);
    return;
  }
  requestBanner();
}

/** Fires the GA4 key event that Google Ads imports as the "Запись на встречу" conversion. */
export function trackBookingConversion() {
  if (!initialized || !window.gtag) return;
  window.gtag("event", "ads_conversion___1");
}
