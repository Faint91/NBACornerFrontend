import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../api/client";
import { Footer } from "../components/layout/Footer";

type PastSeason = {
  season_id: string;
  season_code: string;
  snapshot_at?: string | null;
};

type HistoryIndexResponse = {
  seasons?: PastSeason[];
};

type HistoryColumn = {
  key: string;
  label: string;
  type?: string; // "matchup" | "bonus" | "summary" | unknown
  round?: number | null;
};

type HistoryRow = {
  id: string;
  rank?: number | null;
  display_name: string;
  total_points: number;
  bonus_finalists: number;
  bonus_champion: number;
  full_hits: number;
  partial_hits: number;
  misses: number;
  per_match_points: Record<string, number | null>;
};

type HistorySeasonResponse = {
  season_code: string;
  snapshot_at?: string | null;
  columns: HistoryColumn[];
  rows: HistoryRow[];
};

export const PastSeasonsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { get } = useApi();

  const [seasons, setSeasons] = useState<PastSeason[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const [seasonsError, setSeasonsError] = useState<string | null>(null);

  const [historyColumns, setHistoryColumns] = useState<HistoryColumn[]>([]);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  
  const canShowStatsLink = (seasonCode: string | null | undefined): boolean => {
    if (!seasonCode) return false;
    // Season codes look like "2020-21", "2025-26", etc.
    const yearPart = seasonCode.split("-")[0]?.trim();
    const year = Number.parseInt(yearPart, 10);
    if (Number.isNaN(year)) return false;

    // Only show stats link for seasons 2025-26 and later
    return year >= 2025;
  };

  // Frontend current season code -> filter out of the dropdown
  const CURRENT_SEASON_CODE = (
    import.meta.env.VITE_CURRENT_SEASON_CODE ||
    import.meta.env.VITE_CURRENT_SEASON ||
    ""
  )
    .trim()
    .toLowerCase();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const formatSnapshot = (iso?: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString();
  };

  // ---- Load list of seasons that have history snapshots ----
  useEffect(() => {
    const loadSeasons = async () => {
      try {
        setLoadingSeasons(true);
        setSeasonsError(null);

        const res = (await get(
          "/leaderboard/history"
        )) as HistoryIndexResponse;
        
        let list = res?.seasons ?? [];
        
        if (CURRENT_SEASON_CODE) {
          list = list.filter((s) => {
            const code = (s.season_code || "").trim().toLowerCase();
            return code !== CURRENT_SEASON_CODE;
          });
        }
        
        // 🔽 NEW: sort by starting year desc (e.g. 2024-25 > 2022-23 > 2021-22)
        list.sort((a, b) => {
          const aCode = (a.season_code || "").trim();
          const bCode = (b.season_code || "").trim();
          const aYear = parseInt(aCode.slice(0, 4), 10) || 0;
          const bYear = parseInt(bCode.slice(0, 4), 10) || 0;
          return bYear - aYear;
        });
        
        setSeasons(list);
        
        if (list.length > 0) {
          setSelectedSeason(list[0].season_code);
        } else {
          setSelectedSeason("");
        }
      } catch (err: any) {
        console.error(err);
        setSeasonsError(err.message || "Failed to load past seasons");
      } finally {
        setLoadingSeasons(false);
      }
    };

    loadSeasons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Load snapshot (columns + rows) for selected season ----
  useEffect(() => {
    const loadSeasonHistory = async () => {
      if (!selectedSeason) {
        setHistoryColumns([]);
        setHistoryRows([]);
        setSnapshotAt(null);
        setHistoryError(null);
        return;
      }

      try {
        setHistoryLoading(true);
        setHistoryError(null);

        const res = (await get(
          `/leaderboard/history/${encodeURIComponent(selectedSeason)}`
        )) as HistorySeasonResponse;

        setHistoryColumns(res.columns || []);
        setHistoryRows(res.rows || []);
        setSnapshotAt(res.snapshot_at || null);
      } catch (err: any) {
        console.error(err);
        setHistoryError(err.message || "Failed to load historic leaderboard");
        setHistoryColumns([]);
        setHistoryRows([]);
        setSnapshotAt(null);
      } finally {
        setHistoryLoading(false);
      }
    };

    loadSeasonHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeason]);

  // --- Styling helpers (mirroring LeaderboardPage) ---
  const headerBaseClass =
    "px-3 py-2 text-[11px] font-semibold text-slate-200 bg-slate-900 whitespace-nowrap";
  const cellBaseClass = "px-3 py-2 text-xs whitespace-nowrap";

  // --- Group columns by type/round to add thick separators between rounds/sections ---
  // 0,1,2 = Rank / Name / Points
  const colGroupKeys: string[] = [];
  colGroupKeys[0] = "base";
  colGroupKeys[1] = "base";
  colGroupKeys[2] = "base";

  historyColumns.forEach((col, idx) => {
    const globalIndex = 3 + idx; // first dynamic column = index 3
    const t = (col.type || "").toLowerCase();
    let g = "other";

    if (t === "matchup") {
      const r = col.round ?? 0;
      g = `matchup-r${r}`; // e.g. matchup-r1, matchup-r2, ...
    } else if (t === "bonus") {
      g = "bonus";
    } else if (t === "summary") {
      g = "summary";
    }

    colGroupKeys[globalIndex] = g;
  });

  const thickLeftIndices = new Set<number>();
  for (let i = 1; i < colGroupKeys.length; i++) {
    const prev = colGroupKeys[i - 1];
    const curr = colGroupKeys[i];
    if (prev && curr && prev !== curr) {
      // whenever we change group (round/type), add a thick left border
      thickLeftIndices.add(i);
    }
  }

  const getColumnBorderClasses = (
    colIndex: number,
    isHeader: boolean,
    lastColumnIndex: number
  ) => {
    const classes: string[] = [];

    // top border for header row
    if (isHeader) {
      classes.push("border-t-2 border-t-indigo-500");
    }

    // left border: outer edge or thick separators between groups
    if (colIndex === 0) {
      classes.push("border-l-2 border-l-indigo-500");
    } else if (thickLeftIndices.has(colIndex)) {
      classes.push("border-l-2 border-l-indigo-500");
    } else {
      classes.push("border-l border-l-slate-700");
    }

    // right border on the last column
    if (colIndex === lastColumnIndex) {
      classes.push("border-r-2 border-r-indigo-500");
    }

    // bottom border
    classes.push("border-b border-b-indigo-500");

    return classes.join(" ");
  };

  const getColumnCellValue = (row: HistoryRow, col: HistoryColumn) => {
    const key = col.key;
    const type = (col.type || "").toLowerCase();

    if (type === "matchup") {
      const v = row.per_match_points?.[key];
      return v ?? "";
    }

    switch (key) {
      case "bonus_finalists":
        return row.bonus_finalists;
      case "bonus_champion":
        return row.bonus_champion;
      case "full_hits":
        return row.full_hits;
      case "partial_hits":
        return row.partial_hits;
      case "misses":
        return row.misses;
      default:
        return "";
    }
  };

  const getSummaryCellClasses = (col: HistoryColumn) => {
    const key = col.key;
    if (key === "full_hits") return "text-emerald-300";
    if (key === "partial_hits") return "text-blue-300";
    if (key === "misses") return "text-slate-400";
    if (key === "bonus_finalists" || key === "bonus_champion")
      return "text-amber-300";
    return "text-slate-100";
  };

  // Rank, Name, Points = 0,1,2 → dynamic cols start at 3
  const lastColumnIndex = 2 + historyColumns.length;

  return (
    <div className="min-h-screen text-slate-100 flex flex-col">
      {/* Header (same as other pages) */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-xl font-semibold tracking-tight hover:text-slate-100"
          >
            NBA Corner
          </button>

		  {/* Top navigation */}
          <nav className="flex items-center gap-2">
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

        <div className="flex items-center gap-3">
          {user && (
            <span className="text-sm text-slate-300">
              Logged in as{" "}
              <span className="font-semibold">{user.username}</span>
            </span>
          )}
          <button
            onClick={handleLogout}
            className="text-sm px-3 py-1 rounded-md border border-slate-600 hover:bg-slate-800"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main content – same width behavior as LeaderboardPage */}
            <main className="flex-1 p-6 space-y-4">
        <h2 className="text-xl font-semibold mb-2">Global leaderboard</h2>

        {/* Season selector */}
        {loadingSeasons && (
          <p className="text-sm text-slate-300">Loading seasons…</p>
        )}

        {seasonsError && (
          <p className="text-sm text-red-400">{seasonsError}</p>
        )}

        {!loadingSeasons && !seasonsError && seasons.length === 0 && (
          <p className="text-sm text-slate-400">
            No past seasons found yet. Once you create snapshots for completed
            seasons, they will appear here.
          </p>
        )}

        {!loadingSeasons && !seasonsError && seasons.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-col gap-2 max-w-xl">
              <label
                htmlFor="season-select"
                className="text-sm text-slate-300"
              >
                Select a past season
              </label>
        
              <div className="flex items-center gap-3">
                <select
                  id="season-select"
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  className="rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {seasons.map((s) => (
                    <option key={s.season_id} value={s.season_code}>
                      {s.season_code} season
                    </option>
                  ))}
                </select>
        
                {canShowStatsLink(selectedSeason) && (
                  <p className="text-xs sm:text-sm text-slate-300">
                    For more stats of the season,{" "}
                    <button
                      type="button"
                      onClick={() =>
                        navigate("/league-stats", {
                          state: {
                            leagueId: null,
                            leagueName: selectedSeason
                              ? `${selectedSeason} season`
                              : "Past season stats",
                            seasonCode: selectedSeason || null,
                          },
                        })
                      }
                      className="text-indigo-300 hover:text-indigo-200 underline"
                    >
                      click here
                    </button>
                    .
                  </p>
                )}
              </div>
            </div>
          </div>
        )}



        {/* Historic table */}
        {historyLoading && (
          <p className="text-sm text-slate-300">
            Loading historic leaderboard…
          </p>
        )}

        {historyError && (
          <p className="text-sm text-red-400">{historyError}</p>
        )}

        {!historyLoading &&
          !historyError &&
          selectedSeason &&
          historyRows.length === 0 && (
            <p className="text-sm text-slate-400">
              No leaderboard snapshot data found for this season yet.
            </p>
          )}

        {!historyLoading &&
          !historyError &&
          historyRows.length > 0 &&
          historyColumns.length > 0 && (
            <div className="relative">
              <div className="overflow-x-auto pb-4">
                <table className="min-w-max border-separate border-spacing-0">
                  <thead>
                    <tr>
                      {/* Rank */}
                      <th
                        className={`${headerBaseClass} ${getColumnBorderClasses(
                          0,
                          true,
                          lastColumnIndex
                        )} text-center text-[16px]`}
                      >
                        Rank
                      </th>
                      {/* Name */}
                      <th
                        className={`${headerBaseClass} ${getColumnBorderClasses(
                          1,
                          true,
                          lastColumnIndex
                        )} text-left text-[16px]`}
                      >
                        Name
                      </th>
                      {/* Points */}
                      <th
                        className={`${headerBaseClass} ${getColumnBorderClasses(
                          2,
                          true,
                          lastColumnIndex
                        )} text-center text-[16px]`}
                      >
                        Points
                      </th>

                      {/* Dynamic columns from snapshot */}
                      {historyColumns.map((col, idx) => {
                        const colIndex = 3 + idx;
                        return (
                          <th
                            key={col.key}
                            className={`${headerBaseClass} ${getColumnBorderClasses(
                              colIndex,
                              true,
                              lastColumnIndex
                            )} text-center text-[16px]`}
                          >
                            {col.label}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody>
                    {historyRows.map((row, idx) => {
                      const rank =
                        typeof row.rank === "number" && row.rank > 0
                          ? row.rank
                          : idx + 1;

                      const baseBg =
                        idx % 2 === 0 ? "bg-slate-900" : "bg-slate-900/80";

                      return (
                        <tr key={row.id} className={baseBg}>
                          {/* Rank */}
                          <td
                            className={`${cellBaseClass} ${getColumnBorderClasses(
                              0,
                              false,
                              lastColumnIndex
                            )} text-center text-slate-200 text-[15px]`}
                          >
                            {rank}
                          </td>
                          {/* Name */}
                          <td
                            className={`${cellBaseClass} ${getColumnBorderClasses(
                              1,
                              false,
                              lastColumnIndex
                            )} text-left text-slate-100 text-[15px]`}
                          >
                            {row.display_name}
                          </td>
                          {/* Points */}
                          <td
                            className={`${cellBaseClass} ${getColumnBorderClasses(
                              2,
                              false,
                              lastColumnIndex
                            )} text-center text-slate-100 font-semibold text-[15px]`}
                          >
                            {row.total_points}
                          </td>

                          {/* Dynamic cells */}
                          {historyColumns.map((col, cIdx) => {
                            const colIndex = 3 + cIdx;
                            const val = getColumnCellValue(row, col);
                            const extraClass = getSummaryCellClasses(col);

                            return (
                              <td
                                key={col.key}
                                className={`${cellBaseClass} ${getColumnBorderClasses(
                                  colIndex,
                                  false,
                                  lastColumnIndex
                                )} text-center text-[15px] ${extraClass}`}
                              >
                                {val === 0 || val ? val : ""}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
      </main>
	  <Footer />
    </div>
  );
};
