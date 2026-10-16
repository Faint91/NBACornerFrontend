import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { useLeaguesApi } from "../../api/leagues";
import type { LeagueHistoryResponse, LeagueHistorySeason } from "../../api/leagues";

type Props = { leagueId: string; onHistoricalChange: (selected: boolean) => void };

export function LeagueHistoryPanel({ leagueId, onHistoricalChange }: Props) {
  const { token } = useAuth();
  const { getLeagueHistorySeasons, getLeagueHistory } = useLeaguesApi();
  const [seasons, setSeasons] = useState<LeagueHistorySeason[]>([]);
  const [selected, setSelected] = useState("");
  const [history, setHistory] = useState<LeagueHistoryResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const refetch = () => setRefresh((value) => value + 1);
    window.addEventListener("focus", refetch);
    return () => window.removeEventListener("focus", refetch);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Never keep previously authorized rows visible while authority is refetched.
    setHistory(null);
    setSeasons([]);
    setError("");
    setLoading(true);
    async function load() {
      try {
        const available = await getLeagueHistorySeasons(leagueId);
        const result = selected ? await getLeagueHistory(leagueId, selected) : null;
        if (cancelled) return;
        setSeasons(available.seasons);
        setHistory(result);
      } catch (failure) {
        if (cancelled) return;
        setHistory(null);
        setSeasons([]);
        setError(failure instanceof Error ? failure.message : "League history unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
    // API hook methods are reconstructed on render; token/ID/selection own the request lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, token, selected, refresh]);

  function choose(value: string) {
    setHistory(null);
    setSelected(value);
    onHistoricalChange(!!value);
  }

  return (
    <section className="my-3 space-y-3" aria-label="League season leaderboard">
      <label className="block text-sm">Competition season
        <select value={selected} onChange={(event) => choose(event.target.value)} className="ml-2 rounded border border-slate-600 bg-slate-900 px-2 py-1">
          <option value="">Current leaderboard</option>
          {seasons.map((season) => <option key={season.season_code} value={season.season_code}>{season.season_code}</option>)}
        </select>
      </label>
      {loading && <p role="status">Loading league seasons...</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !selected && !seasons.length && <p className="text-sm text-slate-400">No finalized league seasons yet.</p>}
      {history && selected && !loading && !error && <div className="overflow-x-auto">
        <h3 className="font-semibold">{history.league.name} — {history.season_code}</h3>
        <p className="text-sm text-slate-400">Finalized standings. Membership changes do not alter these results.</p>
        <table className="mt-2 w-full text-left text-sm">
          <thead><tr><th scope="col">Rank</th><th scope="col">Competitor</th><th scope="col">Points</th><th scope="col">Full hits</th><th scope="col">Partial hits</th><th scope="col">Misses</th><th scope="col">Finalists bonus</th><th scope="col">Champion bonus</th></tr></thead>
          <tbody>{history.rows.map((row) => <tr key={row.display_order}>
            <td>{row.rank}</td><td>{row.display_name}</td><td>{row.total_points}</td><td>{row.full_hits}</td><td>{row.partial_hits}</td><td>{row.misses}</td><td>{row.bonus_finalists}</td><td>{row.bonus_champion}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  );
}
