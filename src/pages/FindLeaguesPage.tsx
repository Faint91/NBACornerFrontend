import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLeaguesApi } from "../api/leagues";
import { useAuth } from "../auth/AuthContext";
import type { LeagueSummary } from "../api/leagues";
import { Footer } from "../components/layout/Footer";

export const FindLeaguesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { getAllLeagues, joinLeague } = useLeaguesApi();

  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccessMessage, setJoinSuccessMessage] = useState<string | null>(null);
  const [joinFeedbackLeagueId, setJoinFeedbackLeagueId] = useState<string | null>(null);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const handleNavClick = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false); // close menu after navigating
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getAllLeagues();
        if (!cancelled) {
          const sorted = [...(data || [])].sort((a, b) => {
            const aJoined = !!a.is_member;
            const bJoined = !!b.is_member;

            // 1) Non-members first, members after
            if (aJoined !== bJoined) {
              return aJoined ? 1 : -1;
            }

            // 2) Within each group, sort alphabetically by name
            const nameA = (a.name || "").toLowerCase();
            const nameB = (b.name || "").toLowerCase();
            return nameA.localeCompare(nameB);
          });

          setLeagues(sorted);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load leagues");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const filteredLeagues = leagues.filter((league) => {
    if (!searchTerm.trim()) return true;
    const name = (league.name || "").toLowerCase();
    return name.includes(searchTerm.trim().toLowerCase());
  });
  
  const publicLeagues = filteredLeagues.filter(
    (league) => !league.requires_password
  );
  const privateLeagues = filteredLeagues.filter(
    (league) => league.requires_password
  );

  const handleJoin = async (leagueId: string) => {
    const league = leagues.find((l) => l.id === leagueId);
    const requiresPassword = !!league?.requires_password;

    const password = passwords[leagueId] || "";

    // All feedback messages (error/success) belong to this league
    setJoinFeedbackLeagueId(leagueId);
    setJoinSuccessMessage(null);

    if (requiresPassword && !password) {
      setJoinError("Please enter the league password.");
      return;
    }

    try {
      setJoinError(null);
      setJoiningId(leagueId);
      // For public leagues, send empty string as password
      await joinLeague(leagueId, requiresPassword ? password : "");

      // Mark this league as joined locally
      setLeagues((prev) =>
        prev.map((l) =>
          l.id === leagueId
            ? {
                ...l,
                is_member: true,
                member_count:
                  typeof l.member_count === "number"
                    ? l.member_count + 1
                    : l.member_count,
              }
            : l
        )
      );

      // Clear the password field for this league
      setPasswords((prev) => ({ ...prev, [leagueId]: "" }));

      const joinedLeague = leagues.find((l) => l.id === leagueId);
      setJoinSuccessMessage(
        joinedLeague
          ? `You have successfully joined "${joinedLeague.name}".`
          : "You have successfully joined this league."
      );
    } catch (err: any) {
      setJoinSuccessMessage(null);
      setJoinError(err?.message || "Failed to join league");
    } finally {
      setJoiningId(null);
    }
  };



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
      <main className="flex-1 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Find a league</h2>
        </div>
		
		<div className="mb-2">
          <label className="block text-xs text-slate-300 mb-1">
            Filter by name
          </label>
          <input
            type="search"
            name="league-name-filter"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            readOnly
            onFocus={(e) => {
              // Remove readonly on first focus so user can type,
              // but many browsers won't try to autofill this field.
              (e.target as HTMLInputElement).removeAttribute("readonly");
            }}
            className="w-full max-w-xs text-sm px-2 py-1 rounded-md bg-slate-900 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Type to filter leagues..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading && (
          <p className="text-sm text-slate-300">Loading leagues...</p>
        )}

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {!loading && !error && leagues.length === 0 && (
          <p className="text-sm text-slate-400">
            There are no leagues yet.
          </p>
        )}

        {!loading && leagues.length > 0 && (
          <>
            {filteredLeagues.length === 0 ? (
              <p className="text-sm text-slate-400">
                No leagues match this filter.
              </p>
            ) : (
              <div className="space-y-6">
                {/* Public leagues */}
                <section>
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">
                    Public leagues
                  </h3>

                  {publicLeagues.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No public leagues match this filter.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {publicLeagues.map((league) => (
                        <div
                          key={league.id}
                          className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold">{league.name}</div>
                            <div className="text-xs text-slate-400">
                              {league.is_member
                                ? "You are a member of this league"
                                : "You are not a member yet"}
                            </div>

                            {typeof league.member_count === "number" && (
                              <div className="text-xs text-slate-400 mt-1">
                                {league.member_count} member
                                {league.member_count === 1 ? "" : "s"}
                              </div>
                            )}
                          </div>

                          {(!league.is_member ||
                            joinFeedbackLeagueId === league.id) && (
                            <div className="flex flex-col items-end gap-1">
                              {!league.is_member && (
                                <button
                                  type="button"
                                  onClick={() => handleJoin(league.id)}
                                  disabled={joiningId === league.id}
                                  className="text-xs px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                  {joiningId === league.id
                                    ? "Joining..."
                                    : "Join"}
                                </button>
                              )}

                              {joinFeedbackLeagueId === league.id &&
                                joinError && (
                                  <p className="text-xs text-red-400">
                                    {joinError}
                                  </p>
                                )}

                              {joinFeedbackLeagueId === league.id &&
                                !joinError &&
                                joinSuccessMessage && (
                                  <p className="text-xs text-emerald-400">
                                    {joinSuccessMessage}
                                  </p>
                                )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Private leagues */}
                <section>
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">
                    Private leagues
                  </h3>

                  {privateLeagues.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      No private leagues match this filter.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {privateLeagues.map((league) => (
                        <div
                          key={league.id}
                          className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold">{league.name}</div>
                            <div className="text-xs text-slate-400">
                              {league.is_member
                                ? "You are a member of this league"
                                : "You are not a member yet"}
                            </div>

                            {typeof league.member_count === "number" && (
                              <div className="text-xs text-slate-400 mt-1">
                                {league.member_count} member
                                {league.member_count === 1 ? "" : "s"}
                              </div>
                            )}
                          </div>

                          {(!league.is_member ||
                            joinFeedbackLeagueId === league.id) && (
                            <div className="flex flex-col items-end gap-1">
                              {!league.is_member && (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="password"
                                    name={`league-password-${league.id}`}
                                    autoComplete="off"
                                    className="text-xs px-2 py-1 rounded-md bg-slate-900 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    placeholder="Password"
                                    value={passwords[league.id] || ""}
                                    onChange={(e) =>
                                      setPasswords((prev) => ({
                                        ...prev,
                                        [league.id]: e.target.value,
                                      }))
                                    }
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleJoin(league.id)}
                                    disabled={joiningId === league.id}
                                    className="text-xs px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                                  >
                                    {joiningId === league.id
                                      ? "Joining..."
                                      : "Join"}
                                  </button>
                                </div>
                              )}

                              {joinFeedbackLeagueId === league.id &&
                                joinError && (
                                  <p className="text-xs text-red-400">
                                    {joinError}
                                  </p>
                                )}

                              {joinFeedbackLeagueId === league.id &&
                                !joinError &&
                                joinSuccessMessage && (
                                  <p className="text-xs text-emerald-400">
                                    {joinSuccessMessage}
                                  </p>
                                )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </main>
	  <Footer />
    </div>
  );
};
