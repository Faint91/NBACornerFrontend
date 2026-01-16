import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "./analytics";

export function usePageViews() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname + location.search;
    trackPageView(path);
  }, [location]);
}
