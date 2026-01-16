import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../api/client";
import { useLeaguesApi } from "../api/leagues";
import type { LeagueSummary } from "../api/leagues";
import { Footer } from "../components/layout/Footer";
import { trackEvent } from "../lib/analytics";

type BracketListItem = {
  bracket_id: string;
  created_at: string | null;
  saved_at: string | null;
  is_done?: boolean;
  name?: string | null;
  user: {
    id: string;
    username: string;
  };
};

type MyBracketEnvelope = {
  bracket: BracketListItem | null;
  playoffs_locked?: boolean;
  bracket_creation_open?: boolean;
};

export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { get, post, del } = useApi();
  const navigate = useNavigate();
  
  const { getMyLeagues } = useLeaguesApi();
  const [myLeagues, setMyLeagues] = useState<LeagueSummary[]>([]);
  const [isLoadingLeagues, setIsLoadingLeagues] = useState(false);
  const [leaguesError, setLeaguesError] = useState<string | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [autoSelectedLeague, setAutoSelectedLeague] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);


  const isAdmin = !!(user as any)?.is_admin;

  const [brackets, setBrackets] = useState<BracketListItem[]>([]);
  const [myBracket, setMyBracket] = useState<BracketListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // server-driven flags
  const [playoffsLocked, setPlayoffsLocked] = useState<boolean>(false);
  const [creationOpen, setCreationOpen] = useState<boolean>(true);

  // State for custom delete confirmation modal
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  
  const handleNavClick = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false); // close menu after navigating
};

  const loadBrackets = async (leagueId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      // Always load my bracket (for "My bracket" section + flags)
      const mineRaw = await get("/brackets/me");

      const mineEnv: MyBracketEnvelope =
        mineRaw && typeof mineRaw === "object"
          ? (mineRaw as MyBracketEnvelope)
          : { bracket: null };

      const mine: BracketListItem | null = mineEnv.bracket ?? null;
      setMyBracket(mine);

      // flags from backend (source of truth)
      setPlayoffsLocked(Boolean(mineEnv.playoffs_locked));
      if (typeof mineEnv.bracket_creation_open === "boolean") {
        setCreationOpen(mineEnv.bracket_creation_open);
      }

      // Only load brackets when a league is selected
      let allBrackets: BracketListItem[] = [];
      if (leagueId) {
        const allRaw = await get(`/brackets?league_id=${leagueId}`);

        if (Array.isArray(allRaw)) {
          allBrackets = allRaw as BracketListItem[];
        } else if (allRaw && Array.isArray((allRaw as any).rows)) {
          allBrackets = (allRaw as any).rows as BracketListItem[];
        }
      }

      // don't duplicate "my bracket" in the league list
      setBrackets(
        mine
          ? allBrackets.filter((b) => b.bracket_id !== mine.bracket_id)
          : allBrackets
      );
    } catch (err: any) {
      console.error("loadBrackets failed:", err);
      setError(err?.message ?? "Failed to load brackets");
      setMyBracket(null);
      setBrackets([]);
    } finally {
      setLoading(false);
    }
  };

  const sortedLeagues = useMemo(
    () =>
      [...myLeagues].sort((a, b) => {
        const nameA = (a.name || "").toLowerCase();
        const nameB = (b.name || "").toLowerCase();
        return nameA.localeCompare(nameB);
      }),
    [myLeagues]
  );
  
  useEffect(() => {
    if (autoSelectedLeague) return;
    if (!sortedLeagues || sortedLeagues.length === 0) return;
    if (selectedLeagueId) return;

    const first = sortedLeagues[0];
    setSelectedLeagueId(first.id);
    loadBrackets(first.id);
    setAutoSelectedLeague(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedLeagues, selectedLeagueId, autoSelectedLeague]);
  
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

  useEffect(() => {
    loadBrackets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateBracket = async () => {
    try {
      setCreating(true);
      setError(null);
      const resp = await post("/bracket/create", {});
      const newId = resp.bracket?.id;
      if (!newId) {
        throw new Error("No bracket id returned from API");
      }
	  trackEvent("bracket_created");

      navigate(`/bracket/${newId}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create bracket");
    } finally {
      setCreating(false);
    }
  };

  // Open the custom confirmation modal
  const handleRequestDelete = (id: string) => {
    setDeleteTargetId(id);
    setConfirmDeleteOpen(true);
  };

  // Confirm delete inside the modal
  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      setDeletingId(deleteTargetId);
      setError(null);
      await del(`/bracket/${deleteTargetId}`);
      await loadBrackets(selectedLeagueId || undefined); // reload both myBracket + list
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to delete bracket");
    } finally {
      setDeletingId(null);
      setConfirmDeleteOpen(false);
      setDeleteTargetId(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDeleteOpen(false);
    setDeleteTargetId(null);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleString();
  };
  
    const selectedLeague =
    selectedLeagueId
      ? myLeagues.find((l) => l.id === selectedLeagueId) ?? null
      : null;

  const otherBrackets = brackets;

  // Create button rules:
  // - Everyone: blocked before regular season ends (!creationOpen)
  // - Regular users: also blocked once playoffsLocked
  // - Admins: allowed even if playoffsLocked (to create master), but still not before regular season end
  const createDisabled =
    creating ||
    !!myBracket ||
    (!isAdmin && (!creationOpen || playoffsLocked));

  // 👉 label condition for "Brackets disabled" when regular season is still ongoing
  const disabledBecauseSeasonOngoing = !creationOpen && !playoffsLocked;

  return (
    <div className="min-h-screen w-full overflow-x-hidden text-slate-100 flex flex-col">
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
                    navigate("/account");
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left text-sm px-3 py-2 rounded-md hover:bg-slate-800"
                >
                  Account
                </button>
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

      <main className="flex-1 p-6 space-y-6">
        {/* Top controls */}
        <div className="flex items-center justify-between">
          {/* Left side: title + Refresh */}
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Playoff Brackets</h2>
          </div>

          {/* Right side: create bracket */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateBracket}
              disabled={createDisabled}
              className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-sm"
            >
              {myBracket
                ? "You already have a bracket"
                : creating
                ? "Creating..."
                : disabledBecauseSeasonOngoing
                ? "Brackets disabled"
                : "Create my bracket"}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {/* My bracket section */}
        <section className="space-y-2">
          <h3 className="text-md font-semibold">My bracket</h3>

          {loading && !myBracket && (
            <p className="text-slate-300 text-sm">Loading your bracket...</p>
          )}

          {!loading && !myBracket && (
            <p className="text-slate-400 text-sm">
              You don&apos;t have a bracket yet.{" "}
              {!creationOpen
                ? "Bracket creation opens after the regular season ends."
                : playoffsLocked && !isAdmin
                ? "Bracket creation is closed once playoffs start."
                : "Click “Create my bracket” to start."}
            </p>
          )}

          {myBracket && (
            <div className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => navigate(`/bracket/${myBracket.bracket_id}`)}
              >
                <div>
                  <div className="font-semibold">
                    {myBracket.name || "Unnamed bracket"}
                  </div>
                  <div className="text-xs text-slate-400">
                    Owner: {myBracket.user.username}
                  </div>

                  {!myBracket.is_done && (
                    <div className="mt-1 text-[11px] font-semibold text-red-400">
                      Bracket not saved!
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-400 text-right">
                  <div>Created: {formatDate(myBracket.created_at)}</div>
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // don't navigate when clicking delete
                    handleRequestDelete(myBracket.bracket_id);
                  }}
                  disabled={deletingId === myBracket.bracket_id}
                  className="px-3 py-1 rounded-md bg-red-600 hover:bg-red-500 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {deletingId === myBracket.bracket_id ? "Deleting..." : "Delete my bracket"}
                </button>
              </div>
            </div>
          )}
        </section>
		
        {/* My leagues section */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-semibold">My leagues</h3>
          </div>

          {isLoadingLeagues && (
            <p className="text-sm text-slate-300">Loading your leagues...</p>
          )}

          {leaguesError && (
            <p className="text-sm text-red-400">{leaguesError}</p>
          )}

          {!isLoadingLeagues && !leaguesError && sortedLeagues.length === 0 && (
            <p className="text-sm text-slate-400">
              You haven&apos;t joined any leagues yet. Create or join one first.
            </p>
          )}

          {!isLoadingLeagues && !leaguesError && sortedLeagues.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300">Selected league:</span>
              <select
                className="text-xs px-2 py-1 rounded-md bg-slate-900 border border-slate-600"
                value={selectedLeagueId || ""}
                onChange={(e) => {
                  const value = e.target.value || null;
                  setSelectedLeagueId(value);
                  if (value) {
                    loadBrackets(value);
                  }
                }}
              >
                {sortedLeagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.name || "Unnamed league"}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>
		
        {/* League brackets section (no more global list) */}
        <section className="space-y-2">
          <h3 className="text-md font-semibold">
            {selectedLeague ? (
              <>
                Brackets in{" "}
                <button
                  type="button"
                  onClick={() =>
                    navigate("/leagues/info", { state: { leagueId: selectedLeague.id } })
                  }
                  className="underline underline-offset-2 hover:text-indigo-300"
                >
                  {selectedLeague.name}
                </button>
              </>
            ) : (
              "League brackets"
            )}
          </h3>

          {!selectedLeague && (
            <p className="text-slate-400 text-sm">
              Select a league from &quot;My leagues&quot; above to see its brackets here.
            </p>
          )}

          {selectedLeague && loading && otherBrackets.length === 0 && (
            <p className="text-slate-300 text-sm">
              Loading brackets for this league...
            </p>
          )}

          {selectedLeague && !loading && otherBrackets.length === 0 && (
            <p className="text-slate-400 text-sm">
              No other brackets in this league yet.
            </p>
          )}

          {selectedLeague && !loading && otherBrackets.length > 0 && (
            <div className="space-y-2">
              {otherBrackets.map((b) => (
                <button
                  key={b.bracket_id}
                  onClick={() => navigate(`/bracket/${b.bracket_id}`)}
                  className="w-full text-left px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">
                        {b.name || "Unnamed bracket"}
                      </div>
                      <div className="text-xs text-slate-400">
                        Owner: {b.user.username}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
      {/* Custom delete confirmation modal */}
      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-xl bg-slate-800 border border-slate-700 p-5 shadow-xl">
            <h4 className="text-lg font-semibold mb-2">Delete bracket?</h4>
            <p className="text-sm text-slate-300 mb-4">
              This will remove your bracket from NBACorner. You can always create a new one later.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelDelete}
                className="px-3 py-1 text-sm rounded-md border border-slate-600 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={!!deletingId && deletingId === deleteTargetId}
                className="px-3 py-1 text-sm rounded-md bg-red-600 hover:bg-red-500 text-white disabled:opacity-60"
              >
                {deletingId && deletingId === deleteTargetId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
