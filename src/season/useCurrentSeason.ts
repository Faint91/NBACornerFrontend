import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { buildAuthHeaders } from "../api/client";
import { loadCurrentSeason } from "./currentSeason";
import type { SeasonStatus } from "./currentSeason";

export function useCurrentSeason() {
  const { token } = useAuth();
  const [season, setSeason] = useState<SeasonStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => {
    setSeason(null);
    setRevision(value => value + 1);
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    loadCurrentSeason(async () => {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/season`, {
        headers: buildAuthHeaders(token), signal: abort.signal,
      });
      if (!response.ok) throw new Error("Season configuration unavailable");
      return response.json();
    }).then(value => {
      if (!abort.signal.aborted) { setSeason(value); setError(null); }
    }).catch(() => {
      if (!abort.signal.aborted) { setSeason(null); setError("Season configuration unavailable"); }
    });
    return () => abort.abort();
  }, [token, revision]);
  return { season, error, refresh };
}
