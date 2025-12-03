// src/pages/LeagueStatsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../api/client";
import { Footer } from "../components/layout/Footer";
import {
  PieChart,
  Pie,
  Tooltip,
  Cell,
  Legend,
  ResponsiveContainer,
} from "recharts";

type ChampionStatRow = {
  team_id: string;
  team_code: string;
  team_name: string;
  brackets: number;
  percent: number;
};

type LeastPredictedMatchup = {
  match_key: string;
  conference: string | null;
  round: number | null;
  slot: number | null;
  team_a_code: string;
  team_b_code: string;
  team_a_name: string;
  team_b_name: string;
  total_points: number;
};

type ChampionStatsResponse = {
  scope: "global" | "league";
  league_id: string | null;
  total_brackets: number;
  rows: ChampionStatRow[];
  least_predicted_matchup: LeastPredictedMatchup | null;
  most_predicted_matchup: LeastPredictedMatchup | null;
};

type LocationState = {
  leagueId?: string | null;
  leagueName?: string | null;
  seasonCode?: string | null;
};

const PIE_COLORS = [
  "#6366F1",
  "#22C55E",
  "#F97316",
  "#E11D48",
  "#14B8A6",
  "#A855F7",
  "#FACC15",
  "#0EA5E9",
  "#EC4899",
  "#10B981",
  "#F59E0B",
  "#4ADE80",
];

export const LeagueStatsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { get } = useApi();

  const state = (location.state || {}) as LocationState;
  const leagueId = state.leagueId ?? null;
  const leagueNameFromState = state.leagueName ?? null;
  const seasonCode = state.seasonCode ?? null;

  const [stats, setStats] = useState<ChampionStatsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const handleNavClick = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false); // close menu after navigating
  };

  const displayName = useMemo(() => {
    if (seasonCode) {
      return leagueNameFromState || `${seasonCode} season`;
    }
    if (leagueId === null) {
      return leagueNameFromState || "Global leaderboard";
    }
    return leagueNameFromState || "Selected league";
  }, [leagueId, leagueNameFromState, seasonCode]);


  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        let url = "/stats/champion-picks";
        const params = new URLSearchParams();

        if (leagueId) {
          params.set("league_id", leagueId);
        }
        if (seasonCode) {
          params.set("season_code", seasonCode);
        }

        const qs = params.toString();
        if (qs) {
          url += `?${qs}`;
        }

        const response = (await get(url)) as ChampionStatsResponse;
        if (cancelled) return;
        setStats(response);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || "Failed to load league stats.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchStats();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, seasonCode]);

  const chartData = useMemo(
    () =>
      (stats?.rows || []).map((row) => ({
        name: row.team_code,
        label: row.team_name,
        value: row.percent,
        rawPercent: row.percent,
        brackets: row.brackets,
      })),
    [stats]
  );

  const hasData = chartData.length > 0;
  const leastMatchup = stats?.least_predicted_matchup || null;
  const mostMatchup = stats?.most_predicted_matchup || null;
  
  const renderLegend = (props: any) => {
    const { payload } = props;
    if (!payload || !payload.length) return null;

    return (
      <ul className="text-xs space-y-1">
        {payload.map((entry: any) => {
          const p = entry.payload;
          const label = p.label || entry.value;
          const pct =
            typeof p.rawPercent === "number" ? p.rawPercent : p.value;

          return (
            <li
              key={p.name}
              className="flex items-center gap-2"
            >
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span>
                {label}: {pct.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
    );
  };


  return (
    <div className="min-h-screen w-full overflow-x-hidden text-slate-100 flex flex-col'>
      {/* Header / nav */}
      <header className="border-b border-slate-800">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            {/* App title / logo → always goes to dashboard */}
            <button
              onClick={() => navigate("/dashboard")}
              className="text-xl font-semibold tracking-tight hover:text-slate-100"
            >
              NBA Corner
            </button>
      
            {/* Top navigation - desktop only */}
            <nav className="hidden md:flex items-center gap-2">
              <button
                onClick={() => navigate("/dashboard")}
                className="text-sm px-3 py-1 rounded-md border border-transparent hover:bg-slate-800"
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate("/leagues/info")}
                className="text-sm px-3 py-1 rounded-md border border-transparent hover:bg-slate-800"
              >
                My Leagues
              </button>
              <button
                onClick={() => navigate("/leagues/find")}
                className="text-sm px-3 py-1 rounded-md border border-transparent hover:bg-slate-800"
              >
                Find a League
              </button>
              <button
                onClick={() => navigate("/leaderboard")}
                className="text-sm px-3 py-1 rounded-md border border-transparent hover:bg-slate-800"
              >
                Leaderboards
              </button>
              <button
                onClick={() => navigate("/past-seasons")}
                className="text-sm px-3 py-1 rounded-md border border-transparent hover:bg-slate-800"
              >
                Past Seasons
              </button>
              {user?.is_admin && (
                <button
                  onClick={() => navigate("/admin")}
                  className="text-sm px-3 py-1 rounded-md border border-transparent hover:bg-slate-800"
                >
                  Admin
                </button>
              )}
              <button
                onClick={() => navigate("/account")}
                className="text-sm px-3 py-1 rounded-md border border-transparent hover:bg-slate-800"
              >
                Account
              </button>
            </nav>
          </div>
      
          {/* Right side: user info + logout - desktop only */}
          <div className="hidden md:flex items-center gap-3">
            {user && (
              <span className="text-sm text-slate-300">
                Logged in as <span className="font-semibold">{user.username}</span>
              </span>
            )}
            <button
              onClick={logout}
              className="text-sm px-3 py-1 rounded-md border border-slate-600 hover:bg-slate-800"
            >
              Logout
            </button>
          </div>
      
          {/* Mobile hamburger button */}
          <button
            type="button"
            className="inline-flex items-center rounded-md border border-slate-600 px-3 py-1 text-sm text-slate-100 hover:bg-slate-800 md:hidden"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          >
            <span className="mr-1">Menu</span>
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              {isMobileMenuOpen ? (
                // X icon
                <path
                  fill="currentColor"
                  d="M6.225 4.811 4.81 6.225 10.586 12l-5.775 5.775 1.414 1.414L12 13.414l5.775 5.775 1.414-1.414L13.414 12l5.775-5.775-1.414-1.414L12 10.586 6.225 4.81z"
                />
              ) : (
                // Hamburger icon
                <path
                  fill="currentColor"
                  d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"
                />
              )}
            </svg>
          </button>
        </div>
      
        {/* Mobile menu panel */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-950/95">
            <nav className="flex flex-col gap-1 px-6 py-3">
              <button
                onClick={() => {
                  navigate("/dashboard");
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-slate-800"
              >
                Dashboard
              </button>
              <button
                onClick={() => {
                  navigate("/leagues/info");
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-slate-800"
              >
                My Leagues
              </button>
              <button
                onClick={() => {
                  navigate("/leagues/find");
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-slate-800"
              >
                Find a League
              </button>
              <button
                onClick={() => {
                  navigate("/leaderboard");
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-slate-800"
              >
                Leaderboards
              </button>
              <button
                onClick={() => {
                  navigate("/past-seasons");
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-slate-800"
              >
                Past Seasons
              </button>
      
              {user?.is_admin && (
                <button
                  onClick={() => {
                    navigate("/admin");
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-slate-800"
                >
                  Admin
                </button>
              )}
      
              <div className="mt-3 border-t border-slate-800 pt-2">
                {user && (
                  <div className="mb-1 text-xs text-slate-300">
                    Logged in as{" "}
                    <span className="font-semibold">{user.username}</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full text-left text-sm px-3 py-2 rounded-md border border-slate-600 hover:bg-slate-800"
                >
                  Logout
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>
      <main className="flex-1 p-6 flex justify-center">
        <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900/70 p-6 space-y-6 shadow-sm shadow-slate-900/70">
          {/* Header */}
          <section className="space-y-1">
            <h1 className="text-xl font-semibold">League stats</h1>
            <p className="text-xs text-slate-400">
              Distribution of NBA champion picks across all brackets for the
              current season.
            </p>
            <p className="text-[11px] text-slate-400">
              Scope:{" "}
              <span className="font-semibold text-slate-200">
                {displayName}
              </span>
            </p>
          </section>

          {/* Error */}
          {error && (
            <div className="rounded-md border border-red-500/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          {/* Chart + table */}
          <section className="space-y-4">
            {loading ? (
              <p className="text-sm text-slate-400">Loading stats...</p>
            ) : !hasData ? (
              <p className="text-sm text-slate-400">
                There are no completed brackets with a champion pick yet for{" "}
                <span className="font-semibold">{displayName}</span>.
              </p>
            ) : (
              <>
                {/* Legend + pie chart */}
                <div className="w-full px-4 py-4">
                  <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                    {/* Legend on the left */}
                    <div className="w-full md:w-64">
                      <ul className="text-sm sm:text-base space-y-1.5">
                        {chartData.map((entry, index) => (
                          <li
                            key={entry.name}
                            className="flex items-center gap-2"
                          >
                            <span
                              className="inline-block w-3.5 h-3.5 rounded-sm"
                              style={{
                                backgroundColor:
                                  PIE_COLORS[index % PIE_COLORS.length],
                              }}
                            />
                            <span className="font-medium">
                              {entry.label}: {entry.rawPercent.toFixed(1)}%
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Pie chart on the right */}
                    <div className="flex-1 w-full h-80 overflow-visible">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={110}
                          >
                            {chartData.map((entry, index) => (
                              <Cell
                                key={entry.name}
                                fill={PIE_COLORS[index % PIE_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          {/* No Tooltip, no Legend → no hover effects */}
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Table under the chart */}
                <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60">
                  <table className="min-w-full text-xs sm:text-sm">
                    <thead className="bg-slate-900/80">
                      <tr className="text-left text-slate-300">
                        <th className="px-3 py-2 font-medium">Team</th>
                        <th className="px-3 py-2 font-medium text-right">
                          Brackets
                        </th>
                        <th className="px-3 py-2 font-medium text-right">
                          % of brackets
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.map((row) => (
                        <tr
                          key={row.name}
                          className="border-t border-slate-800/80"
                        >
                          <td className="px-3 py-2">
                            <span className="font-medium">
                              {row.label}
                            </span>
                            <span className="ml-2 text-[11px] text-slate-400">
                              ({row.name})
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {row.brackets}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {row.rawPercent.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {leastMatchup && (
                  <p className="mt-3 text-xs sm:text-sm text-slate-300">
                    Least predicted matchup:{" "}
                    <span className="font-semibold">
                      {leastMatchup.team_a_name} vs {leastMatchup.team_b_name}
                    </span>
                    {": "}
                    {Math.round(leastMatchup.total_points)} points
                  </p>
                )}
                {mostMatchup && (
                  <p className="mt-1 text-xs sm:text-sm text-slate-300">
                    Most predicted matchup:{" "}
                    <span className="font-semibold">
                      {mostMatchup.team_a_name} vs {mostMatchup.team_b_name}
                    </span>
                    {": "}
                    {Math.round(mostMatchup.total_points)} points
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};
