// src/lib/analytics.ts
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

function hasGtag(): boolean {
  return Boolean(GA_ID && typeof window !== "undefined" && typeof window.gtag === "function");
}

export function trackEvent(name: string, params: Record<string, any> = {}) {
  if (!hasGtag()) return;
  window.gtag!("event", name, params);
}

export function trackPageView(path: string, title?: string) {
  if (!hasGtag()) return;

  window.gtag!("event", "page_view", {
    page_location: window.location.origin + path,
    page_path: path,
    page_title: title ?? document.title,
  });
}

// Use ONLY a non-PII internal ID (e.g. your Supabase UUID). :contentReference[oaicite:3]{index=3}
export function setUserId(userId: string | null) {
  if (!hasGtag()) return;

  if (userId) {
    // gtag supports setting user_id. It must not be PII. :contentReference[oaicite:4]{index=4}
    window.gtag!("set", "user_id", userId);
  } else {
    // Clear it on logout
    window.gtag!("set", "user_id", undefined);
  }
}
