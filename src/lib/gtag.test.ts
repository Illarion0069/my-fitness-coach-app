import { beforeEach, describe, expect, it, vi } from "vitest";

const CONSENT_KEY = "ads_consent_v1";
const SENT_KEY = "ads_conv_sent_v1";

async function setupMeasurement() {
  vi.resetModules();
  localStorage.setItem(CONSENT_KEY, JSON.stringify({
    choice: "granted",
    ts: new Date().toISOString(),
    version: "2026-10-25",
    region: "CY",
  }));
  const gtag = await import("./gtag");
  await gtag.initGoogleAnalytics();
  return gtag;
}

function conversionEvents() {
  return (window.dataLayer || [])
    .map((entry) => Array.from(entry as unknown[]))
    .filter((entry) => entry[0] === "event" && entry[1] === "conversion");
}

describe("Google Ads booking conversion", () => {
  beforeEach(() => {
    localStorage.clear();
    window.dataLayer = [];
    delete window.gtag;
    document.head.querySelectorAll('script[src*="googletagmanager.com"]').forEach((node) => node.remove());
  });

  it("sends the verified conversion ID, label and unique booking ID", async () => {
    const gtag = await setupMeasurement();

    gtag.trackBookingConversion("guest_booking-123");

    expect(conversionEvents()).toHaveLength(1);
    expect(conversionEvents()[0][2]).toEqual({
      send_to: "AW-16662095581/YM_pCKD05LcdEN3NjYk-",
      transaction_id: "guest_booking-123",
    });
  });

  it("does not send the same booking twice after a reload", async () => {
    let gtag = await setupMeasurement();
    gtag.trackBookingConversion("session_booking-456");

    gtag = await setupMeasurement();
    gtag.trackBookingConversion("session_booking-456");

    expect(conversionEvents()).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(SENT_KEY) || "[]")).toEqual(["session_booking-456"]);
  });

  it("keeps different guest and client bookings separate", async () => {
    const gtag = await setupMeasurement();

    gtag.trackBookingConversion("guest_booking-123");
    gtag.trackBookingConversion("session_booking-456");

    expect(conversionEvents().map((entry) => (entry[2] as { transaction_id: string }).transaction_id)).toEqual([
      "guest_booking-123",
      "session_booking-456",
    ]);
  });
});
