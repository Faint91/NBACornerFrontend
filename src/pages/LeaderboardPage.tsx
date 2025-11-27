import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../api/client";
import { useLeaguesApi } from "../api/leagues";
import type { LeagueSummary } from "../api/leagues";


type MatchStatus =
  | "pending"
  | "full"
  | "partial"
  | "miss"
  | "no_pick"
  | "no_match";

type MatchPoints = {
  points: number;
  status: MatchStatus;
  conference: string;
  round: number;
  slot: number;
};

type LeaderboardRow = {
  bracket_id: string;
  bracket_name: string | null;
  user_id: string;
  username: string;
  total_points: number;
  full_hits: number;
  partial_hits: number;
  misses: number;
  bonus_finalists: number;
  bonus_champion: number;
  updated_at?: string | null;
  points_by_match?: Record<string, MatchPoints>;
};

type MasterMatchupMeta = {
  conference: string;
  round: number;
  slot: number;
  team_a_code?: string | null;
  team_b_code?: string | null;
};

type LeaderboardApiObject = {
  rows?: LeaderboardRow[];
  master_bracket_id?: string | null;
  master_updated_at?: string | null;
  master_matchups?: Record<string, MasterMatchupMeta>;
};

type LeaderboardResponseShape = LeaderboardApiObject | LeaderboardRow[];

type MyBracketCore = {
  bracket_id: string;
  name?: string | null;
  created_at?: string | null;
  saved_at?: string | null;
  is_done?: boolean;
  user: {
    id: string;
    username: string;
  };
};

type BracketsMeEnvelope = {
  bracket: MyBracketCore | null;
  playoffs_locked?: boolean;
};

export const LeaderboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { get, post } = useApi();
  const navigate = useNavigate();
  const location = useLocation();

  const navState = (location.state as { leagueId?: string } | null) || null;
  const initialLeagueIdFromState = navState?.leagueId ?? null;

  const { getMyLeagues, getLeagueMembers } = useLeaguesApi();

  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [masterMatchups, setMasterMatchups] = useState<
    Record<string, MasterMatchupMeta>
  >({});
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔽 NEW: leagues + filter state
  const [myLeagues, setMyLeagues] = useState<LeagueSummary[]>([]);
  const [isLoadingLeagues, setIsLoadingLeagues] = useState(false);
  const [leaguesError, setLeaguesError] = useState<string | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [leagueSelectionInitialized, setLeagueSelectionInitialized] = useState(false);
  const [selectedLeagueMemberIds, setSelectedLeagueMemberIds] = useState<string[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  const isAdmin = Boolean((user as any)?.is_admin);
  const currentUserId = (user as any)?.id as string | undefined;
  
  const handleLogout = () => {
    logout();
    navigate("/login");
  };
  
  useEffect(() => {
    let cancelled = false;

    const loadLeagues = async () => {
      try {
        setIsLoadingLeagues(true);
        setLeaguesError(null);
        const leagues = await getMyLeagues();
        if (!cancelled) {
          setMyLeagues(leagues);
        }
      } catch (err: any) {
        if (!cancelled) {
          setLeaguesError(err?.message || "Failed to load leagues");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLeagues(false);
        }
      }
    };

    loadLeagues();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLeagueMembers = async (leagueId: string | null) => {
    if (!leagueId) {
      // Back to global leaderboard: no member filter
      setSelectedLeagueMemberIds([]);
      setMembersError(null);
      return;
    }

    try {
      setLoadingMembers(true);
      setMembersError(null);
      const resp = await getLeagueMembers(leagueId);
      const ids = resp.members.map((m) => m.user_id);
      setSelectedLeagueMemberIds(ids);
    } catch (err: any) {
      console.error("loadLeagueMembers failed:", err);
      setMembersError(err?.message || "Failed to load league members");
      setSelectedLeagueMemberIds([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  // Initialize league selection once:
  // - If we have a leagueId from navigation and it's one of my leagues → select it.
  // - Otherwise → select the first alphabetical league.
  useEffect(() => {
    // Don't run again once we've initialized the selection
    if (leagueSelectionInitialized) return;

    // Wait until leagues are loaded
    if (!myLeagues || myLeagues.length === 0) return;

    // 1) If a league was passed via navigation and it's in my leagues, use that
    if (initialLeagueIdFromState) {
      const fromNav = myLeagues.find(
        (l) => l.id === initialLeagueIdFromState
      );
      if (fromNav) {
        setSelectedLeagueId(fromNav.id);
        loadLeagueMembers(fromNav.id);
        setLeagueSelectionInitialized(true);
        return;
      }
      // If the passed league isn't in my leagues, fall through to default below
    }

    // 2) Otherwise, default to the first alphabetical league
    const sorted = [...myLeagues].sort((a, b) => {
      const nameA = (a.name || "").toLowerCase();
      const nameB = (b.name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    const first = sorted[0];
    if (!first) return;

    setSelectedLeagueId(first.id);
    loadLeagueMembers(first.id);
    setLeagueSelectionInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLeagueIdFromState, myLeagues, leagueSelectionInitialized]);

  // Columns 5–25: mapping to match keys in points_by_match
  const matchColumns: { matchKey: string; fallback: string }[] = [
    { matchKey: "east-0-1", fallback: "E R0 S1" }, // col 5
    { matchKey: "west-0-1", fallback: "W R0 S1" }, // col 6
    { matchKey: "east-0-2", fallback: "E R0 S2" }, // col 7
    { matchKey: "west-0-2", fallback: "W R0 S2" }, // col 8
    { matchKey: "east-0-3", fallback: "E R0 S3" }, // col 9
    { matchKey: "west-0-3", fallback: "W R0 S3" }, // col 10

    { matchKey: "east-1-4", fallback: "E R1 S4" }, // col 11
    { matchKey: "east-1-5", fallback: "E R1 S5" }, // col 12
    { matchKey: "east-1-6", fallback: "E R1 S6" }, // col 13
    { matchKey: "east-1-7", fallback: "E R1 S7" }, // col 14

    { matchKey: "west-1-4", fallback: "W R1 S4" }, // col 15
    { matchKey: "west-1-5", fallback: "W R1 S5" }, // col 16
    { matchKey: "west-1-6", fallback: "W R1 S6" }, // col 17
    { matchKey: "west-1-7", fallback: "W R1 S7" }, // col 18

    { matchKey: "east-2-9", fallback: "E R2 S9" }, // col 19
    { matchKey: "east-2-8", fallback: "E R2 S8" }, // col 20
    { matchKey: "west-2-9", fallback: "W R2 S9" }, // col 21
    { matchKey: "west-2-8", fallback: "W R2 S8" }, // col 22

    { matchKey: "east-3-10", fallback: "E R3 S10" }, // col 23
    { matchKey: "west-3-10", fallback: "W R3 S10" }, // col 24

    { matchKey: "nba-4-11", fallback: "Finals" }, // col 25
  ];

  const LAST_COLUMN_INDEX = 29; // 0-based: 0..29 for 30 columns
  const thickLeftIndices = new Set<number>([
    4, // between 4 & 5
    10, // between 10 & 11
    18, // between 18 & 19
    22, // between 22 & 23
    24, // between 24 & 25
    25, // between 25 & 26
    27, // between 27 & 28
  ]);

  const headerBaseClass =
    "px-3 py-2 text-[11px] font-semibold text-slate-200 bg-slate-900 whitespace-nowrap";
  const cellBaseClass = "px-3 py-2 text-xs whitespace-nowrap";

  const getColumnBorderClasses = (colIndex: number, isHeader: boolean) => {
    const classes: string[] = [];

    // top border for header row
    if (isHeader) {
      classes.push("border-t-2 border-t-indigo-500");
    }

    // left border (outer + vertical separators + thick separators)
    if (colIndex === 0) {
      classes.push("border-l-2 border-l-indigo-500");
    } else if (thickLeftIndices.has(colIndex)) {
      classes.push("border-l-2 border-l-indigo-500");
    } else {
      classes.push("border-l border-l-slate-700");
    }

    // right border on the last column
    if (colIndex === LAST_COLUMN_INDEX) {
      classes.push("border-r-2 border-r-indigo-500");
    }

    // bottom border for every cell to form full bottom outline
    classes.push("border-b border-b-indigo-500");

    return classes.join(" ");
  };

  const loadLeaderboard = async () => {
    try {
      setError(null);
      setLoading(true);

      const raw = (await get("/leaderboard")) as LeaderboardResponseShape;

      let rowsData: LeaderboardRow[] = [];
      let masterMeta: Record<string, MasterMatchupMeta> = {};

      if (Array.isArray(raw)) {
        rowsData = raw as LeaderboardRow[];
      } else if (raw && typeof raw === "object") {
        const obj = raw as LeaderboardApiObject;
        rowsData = obj.rows ?? [];
        masterMeta = obj.master_matchups ?? {};
      }

      const cleaned = (rowsData || []).map((r) => ({
        ...r,
        total_points: r.total_points ?? 0,
        full_hits: r.full_hits ?? 0,
        partial_hits: r.partial_hits ?? 0,
        misses: r.misses ?? 0,
        bonus_finalists: r.bonus_finalists ?? 0,
        bonus_champion: r.bonus_champion ?? 0,
      }));

      // Sort: by Points desc, then Full hits desc
      cleaned.sort((a, b) => {
        const ptsA = a.total_points ?? 0;
        const ptsB = b.total_points ?? 0;
        if (ptsB !== ptsA) return ptsB - ptsA;

        const fullA = a.full_hits ?? 0;
        const fullB = b.full_hits ?? 0;
        return fullB - fullA;
      });

      setRows(cleaned);
      setMasterMatchups(masterMeta);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString();
  };

  const handleRecompute = async () => {
    try {
      setRecomputing(true);
      setError(null);

      // 1) Use this admin's bracket as master (via /brackets/me envelope)
      const mineRaw = await get("/brackets/me");
      const envelope: BracketsMeEnvelope | null =
        mineRaw && typeof mineRaw === "object"
          ? (mineRaw as BracketsMeEnvelope)
          : null;

      const mine = envelope?.bracket;

      if (!mine || !mine.bracket_id) {
        throw new Error(
          "You don't have a bracket to use as the master bracket. Create a bracket for this admin user first."
        );
      }

      const masterId = mine.bracket_id;

      // 2) Call recompute endpoint
      await post(`/admin/score/master/${masterId}/recompute`, {});

      // 3) Reload leaderboard
      await loadLeaderboard();
    } catch (err: any) {
      console.error("❌ handleRecompute error:", err);
      setError(err.message || "Failed to recompute scores");
    } finally {
      setRecomputing(false);
    }
  };

  const getMatchHeaderLabel = (matchKey: string, fallback: string) => {
    const meta = masterMatchups[matchKey];
    if (meta && meta.team_a_code && meta.team_b_code) {
      return `${meta.team_a_code} vs ${meta.team_b_code}`;
    }
    return fallback;
  };

  const getMatchCellClasses = (mp?: MatchPoints) => {
    if (!mp || mp.status === "pending") return "";
    if (mp.status === "full") return "text-emerald-300";
    if (mp.status === "partial") return "text-blue-300";
    if (mp.status === "miss") return "text-slate-400";
    return "text-slate-300";
  };

  const getMatchCellDisplay = (mp?: MatchPoints) => {
    if (!mp || mp.status === "pending") return "";
    return mp.points ?? 0;
  };

  const selectedLeague =
    selectedLeagueId
      ? myLeagues.find((l) => l.id === selectedLeagueId) ?? null
      : null;

  const visibleRows =
    selectedLeagueId
      ? rows.filter((r) => selectedLeagueMemberIds.includes(r.user_id))
      : rows;

  return (
    <div className="min-h-screen text-slate-100 flex flex-col">
      {/* Header (same style as dashboard) */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-6">
          {/* App title / logo → always goes to dashboard */}
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
          </nav>
        </div>
      
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-sm text-slate-300">
              Logged in as <span className="font-semibold">{user.username}</span>
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
      <main className="flex-1 p-6 space-y-4">
        {/* League filter (now above scores/controls) */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">League</span>
            <select
              className="text-xs px-2 py-1 rounded-md bg-slate-900 border border-slate-600"
              value={selectedLeagueId || ""}
              disabled={isLoadingLeagues || loadingMembers}
              onChange={(e) => {
                const value = e.target.value || null;
                setSelectedLeagueId(value);
                loadLeagueMembers(value);
              }}
            >
              {[...myLeagues]
                .sort((a, b) => {
                  const nameA = (a.name || "").toLowerCase();
                  const nameB = (b.name || "").toLowerCase();
                  return nameA.localeCompare(nameB);
                })
                .map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.name}
                  </option>
                ))}
              <option value="">Global (all users)</option>
            </select>
          </div>
        </div>

        {/* Top controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold">Scores</h2>

            {isAdmin && (
              <button
                onClick={handleRecompute}
                disabled={recomputing}
                className="px-3 py-2 rounded-md border border-slate-600 hover:bg-slate-800 text-sm disabled:opacity-60"
              >
                {recomputing ? "Recomputing..." : "Recalculate scores"}
              </button>
            )}
          </div>
        </div>


        {leaguesError && (
          <p className="text-xs text-red-400">
            {leaguesError}
          </p>
        )}

        {membersError && (
          <p className="text-xs text-red-400">
            {membersError}
          </p>
        )}

        {error && (
          <p className="text-sm text-red-400">
            {error}
          </p>
        )}

        {loading && (
          <p className="text-sm text-slate-300">Loading leaderboard…</p>
        )}

        {!loading && visibleRows.length === 0 && !error && (
          <p className="text-sm text-slate-400">
            {selectedLeague
              ? "No scored brackets yet for this league."
              : "No scored brackets yet. Once an admin recomputes scores based on the master bracket, they will appear here."}
          </p>
        )}

        {!loading && visibleRows.length > 0 && (
          <div className="relative">
            {/* Horizontal scroll, with padding so the scrollbar doesn't cover the last row */}
            <div className="overflow-x-auto pb-4">
              <table className="min-w-max border-separate border-spacing-0">
                <thead>
                  <tr>
                    {/* 1: Ranking */}
                    <th
                      className={`${headerBaseClass} ${getColumnBorderClasses(
                        0,
                        true
                      )} text-center text-[16px]`}
                    >
                      Ranking
                    </th>
                    {/* 2: Bracket */}
                    <th
                      className={`${headerBaseClass} ${getColumnBorderClasses(
                        1,
                        true
                      )} text-left text-[16px]`}
                    >
                      Bracket
                    </th>
                    {/* 3: Username */}
                    <th
                      className={`${headerBaseClass} ${getColumnBorderClasses(
                        2,
                        true
                      )} text-left text-[16px]`}
                    >
                      Username
                    </th>
                    {/* 4: Points */}
                    <th
                      className={`${headerBaseClass} ${getColumnBorderClasses(
                        3,
                        true
                      )} text-center text-[16px]`}
                    >
                      Points
                    </th>
                
                    {/* 5–25: matchup columns */}
                    {matchColumns.map((col, idx) => {
                      const colIndex = 4 + idx; // absolute index
                      const label = getMatchHeaderLabel(col.matchKey, col.fallback);
                      return (
                        <th
                          key={col.matchKey}
                          className={`${headerBaseClass} ${getColumnBorderClasses(
                            colIndex,
                            true
                          )} text-center text-[16px]`}
                        >
                          {label}
                        </th>
                      );
                    })}
                
                    {/* 26: Bonus finalist */}
                    <th
                      className={`${headerBaseClass} ${getColumnBorderClasses(
                        25,
                        true
                      )} text-right text-[16px]`}
                    >
                      Bonus finalist
                    </th>
                    {/* 27: Bonus champion */}
                    <th
                      className={`${headerBaseClass} ${getColumnBorderClasses(
                        26,
                        true
                      )} text-right text-[16px]`}
                    >
                      Bonus champion
                    </th>
                    {/* 28: Full hits */}
                    <th
                      className={`${headerBaseClass} ${getColumnBorderClasses(
                        27,
                        true
                      )} text-right text-[16px]`}
                    >
                      Full hits
                    </th>
                    {/* 29: Partial hits */}
                    <th
                      className={`${headerBaseClass} ${getColumnBorderClasses(
                        28,
                        true
                      )} text-right text-[16px]`}
                    >
                      Partial hits
                    </th>
                    {/* 30: Misses */}
                    <th
                      className={`${headerBaseClass} ${getColumnBorderClasses(
                        29,
                        true
                      )} text-right text-[16px]`}
                    >
                      Misses
                    </th>
                  </tr>
                </thead>
              
                <tbody>
                  {visibleRows.map((r, idx) => {
                    const isMe = currentUserId && r.user_id === currentUserId;
                    const baseBg =
                      idx % 2 === 0 ? "bg-slate-900" : "bg-slate-900/80";
                    const rowBg = isMe ? "bg-slate-800/90" : baseBg;
              
                    return (
                      <tr key={r.bracket_id} className={rowBg}>
                        {/* 1: Ranking */}
                        <td
                          className={`${cellBaseClass} ${getColumnBorderClasses(
                            0,
                            false
                          )} text-center text-slate-200 text-[15px]`}
                        >
                          {idx + 1}
                        </td>
              
                        {/* 2: Bracket (now linked) */}
                        <td
                          className={`${cellBaseClass} ${getColumnBorderClasses(
                            1,
                            false
                          )} text-slate-100 text-[15px]`}
                        >
                          <button
                            onClick={() => navigate(`/bracket/${r.bracket_id}`)}
                            className="underline underline-offset-2 hover:text-indigo-300"
                            aria-label={`Open bracket ${r.bracket_name || "Unnamed bracket"}`}
                          >
                            {r.bracket_name || "Unnamed bracket"}
                          </button>
                        </td>
              
                        {/* 3: Username */}
                        <td
                          className={`${cellBaseClass} ${getColumnBorderClasses(
                            2,
                            false
                          )} text-slate-300 text-[15px]`}
                        >
                          {r.username}
                        </td>
              
                        {/* 4: Points */}
                        <td
                          className={`${cellBaseClass} ${getColumnBorderClasses(
                            3,
                            false
                          )} text-center text-slate-100 font-semibold text-[15px]`}
                        >
                          {r.total_points}
                        </td>
              
                        {/* 5–25: matchup columns */}
                        {matchColumns.map((col, mIdx) => {
                          const colIndex = 4 + mIdx;
                          const mp = r.points_by_match?.[col.matchKey];
                          const statusClass = getMatchCellClasses(mp);
                          const display = getMatchCellDisplay(mp);
              
                          return (
                            <td
                              key={col.matchKey}
                              className={`${cellBaseClass} ${getColumnBorderClasses(
                                colIndex,
                                false
                              )} text-center ${statusClass} text-[15px]`}
                            >
                              {display}
                            </td>
                          );
                        })}
              
                        {/* 26: Bonus finalist */}
                        <td
                          className={`${cellBaseClass} ${getColumnBorderClasses(
                            25,
                            false
                          )} text-right text-amber-300 text-[15px]`}
                        >
                          {r.bonus_finalists}
                        </td>
                        {/* 27: Bonus champion */}
                        <td
                          className={`${cellBaseClass} ${getColumnBorderClasses(
                            26,
                            false
                          )} text-right text-amber-300 text-[15px]`}
                        >
                          {r.bonus_champion}
                        </td>
                        {/* 28: Full hits */}
                        <td
                          className={`${cellBaseClass} ${getColumnBorderClasses(
                            27,
                            false
                          )} text-right text-emerald-300 text-[15px]`}
                        >
                          {r.full_hits}
                        </td>
                        {/* 29: Partial hits */}
                        <td
                          className={`${cellBaseClass} ${getColumnBorderClasses(
                            28,
                            false
                          )} text-right text-blue-300 text-[15px]`}
                        >
                          {r.partial_hits}
                        </td>
                        {/* 30: Misses */}
                        <td
                          className={`${cellBaseClass} ${getColumnBorderClasses(
                            29,
                            false
                          )} text-right text-slate-400 text-[15px]`}
                        >
                          {r.misses}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
