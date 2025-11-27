import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLeaguesApi } from "../api/leagues";
import { useAuth } from "../auth/AuthContext";
import type { LeagueSummary } from "../api/leagues";

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

  const handleJoin = async (leagueId: string) => {
    const password = passwords[leagueId] || "";

    // All feedback messages (error/success) belong to this league
    setJoinFeedbackLeagueId(leagueId);
    setJoinSuccessMessage(null);

    if (!password) {
      setJoinError("Please enter the league password.");
      return;
    }

    try {
      setJoinError(null);
      setJoiningId(leagueId);
      await joinLeague(leagueId, password);

      // Mark this league as joined locally
      setLeagues((prev) =>
        prev.map((l) =>
          l.id === leagueId ? { ...l, is_member: true } : l
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
    <div className="min-h-screen text-slate-100 flex flex-col">
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
            onClick={logout}
            className="text-sm px-3 py-1 rounded-md border border-slate-600 hover:bg-slate-800"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Find a private league</h2>
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
            There are no private leagues yet.
          </p>
        )}

        {!loading && leagues.length > 0 && (
          <>
            {filteredLeagues.length === 0 ? (
              <p className="text-sm text-slate-400">
                No leagues match this filter.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredLeagues.map((league) => (
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

                    {(!league.is_member || joinFeedbackLeagueId === league.id) && (
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
                              onClick={() => handleJoin(league.id)}
                              disabled={joiningId === league.id}
                              className="text-xs px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60"
                            >
                              {joiningId === league.id ? "Joining..." : "Join"}
                            </button>
                          </div>
                        )}

                        {joinFeedbackLeagueId === league.id && joinError && (
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
          </>
        )}
      </main>
    </div>
  );
};
