const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

function hasGtag() {
  return Boolean(GA_ID && typeof window !== "undefined" && typeof window.gtag === "function");
}

export function trackEvent(name: string, params: Record<string, any> = {}) {
  if (!hasGtag()) return;
  window.gtag!("event", name, params);
}

export function setUserId(userId: string | null) {
  if (!hasGtag()) return;
  if (userId) {
    window.gtag!("set", "user_id", userId);
  } else {
    window.gtag!("set", "user_id", undefined);
  }
}

export function trackPageView(path: string, title?: string) {
  if (!hasGtag()) return;

  window.gtag!("event", "page_view", {
    page_location: window.location.origin + path,
    page_path: path,
    page_title: title ?? document.title,
  });
}