import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useLeaguesApi } from "../api/leagues";
import type { LeagueSummary, LeagueMember } from "../api/leagues";
import { Footer } from "../components/layout/Footer";

export const LeagueInfoPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const {
    getMyLeagues,
    getLeagueMembers,
    createLeague,
    leaveLeague,
    deleteLeague,
  } = useLeaguesApi();

  const navState = (location.state as { leagueId?: string } | null) || null;
  const initialLeagueIdFromState = navState?.leagueId ?? null;

  const currentUserId = (user as any)?.id as string | undefined;

  const [myLeagues, setMyLeagues] = useState<LeagueSummary[]>([]);
  const [members, setMembers] = useState<LeagueMember[]>([]);

  const [isLoadingLeagues, setIsLoadingLeagues] = useState(false);
  const [leaguesError, setLeaguesError] = useState<string | null>(null);

  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [selectedLeagueName, setSelectedLeagueName] = useState<string | null>(
    null
  );

  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);

  // Create league form state
  const [showCreateLeagueForm, setShowCreateLeagueForm] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState("");
  const [newLeaguePassword, setNewLeaguePassword] = useState("");
  const [newLeagueVisibility, setNewLeagueVisibility] = useState<"public" | "private">("public");
  const [creatingLeague, setCreatingLeague] = useState(false);
  const [createLeagueError, setCreateLeagueError] = useState<string | null>(null);
  
  // State for custom confirmation modals
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);


  // Load user's leagues on mount
  useEffect(() => {
    let cancelled = false;

    const loadLeagues = async () => {
      try {
        setIsLoadingLeagues(true);
        setLeaguesError(null);
        const leagues = await getMyLeagues();

        if (!cancelled) {
          const sorted = [...(leagues || [])].sort((a, b) =>
            (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase())
          );
          setMyLeagues(sorted);
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

  // Load members whenever selectedLeagueId changes
  useEffect(() => {
    if (!selectedLeagueId) {
      setMembers([]);
      setMembersError(null);
      setSelectedLeagueName(null);
      return;
    }

    let cancelled = false;

    const loadMembers = async () => {
      try {
        setLoadingMembers(true);
        setMembersError(null);
        const resp = await getLeagueMembers(selectedLeagueId);
        if (cancelled) return;

        setMembers(resp.members);
        setSelectedLeagueName(resp.league.name || null);
      } catch (err: any) {
        if (!cancelled) {
          setMembersError(err?.message || "Failed to load league members");
          setMembers([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingMembers(false);
        }
      }
    };

    loadMembers();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeagueId]);
  
  useEffect(() => {
    if (!initialLeagueIdFromState) return;
    if (selectedLeagueId) return;

    if (!myLeagues || myLeagues.length === 0) return;

    if (!myLeagues.some((l) => l.id === initialLeagueIdFromState)) return;

    // Apply selection; members + name will load via the existing effect
    setSelectedLeagueId(initialLeagueIdFromState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLeagueIdFromState, myLeagues, selectedLeagueId]);

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = newLeagueName.trim();
    const isPrivate = newLeagueVisibility === "private";
    const password = newLeaguePassword.trim();

    if (!name) {
      setCreateLeagueError("Please enter a league name.");
      return;
    }

    if (isPrivate && !password) {
      setCreateLeagueError("Please enter a password for a private league.");
      return;
    }

    try {
      setCreatingLeague(true);
      setCreateLeagueError(null);

      const payload = {
        name,
        // For public leagues we explicitly send empty string so backend treats it as public
        password: isPrivate ? password : "",
      };

      const createdLeague = await createLeague(payload);

      // Add to my leagues and keep them sorted (by name, case-insensitive)
      setMyLeagues((prev) => {
        const updated = [...prev, createdLeague];
        return updated.sort((a, b) =>
          a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        );
      });

      setSelectedLeagueId(createdLeague.id);
      setSelectedLeagueName(createdLeague.name);

      // Reset form
      setNewLeagueName("");
      setNewLeaguePassword("");
      setNewLeagueVisibility("public");
      setShowCreateLeagueForm(false);
    } catch (err: any) {
      setCreateLeagueError(
        err?.message || "Failed to create league. Please try again."
      );
    } finally {
      setCreatingLeague(false);
    }
  };


  const iAmMember = !!(
    currentUserId && members.some((m) => m.user_id === currentUserId)
  );

  const iAmOwner = !!(
    currentUserId &&
    members.some((m) => m.user_id === currentUserId && m.is_owner)
  );
  
  const memberCount = members.length;
  const bracketCount = members.filter((m) => m.has_bracket).length;
  const ownerMember = members.find((m) => m.is_owner);
  
  const selectedLeagueDisplayName = selectedLeagueName || "this league";
  
    // Open the custom confirmation modal for leaving
  const handleRequestLeaveLeague = () => {
    if (!selectedLeagueId) return;
    setConfirmLeaveOpen(true);
  };

  const handleLeaveLeague = async () => {
    if (!selectedLeagueId) return;

    try {
      setLoadingMembers(true);
      setMembersError(null);
      await leaveLeague(selectedLeagueId);

      // Remove league locally and reset selection
      setMyLeagues((prev) => prev.filter((l) => l.id !== selectedLeagueId));
      setSelectedLeagueId(null);
      setSelectedLeagueName(null);
      setMembers([]);
    } catch (err: any) {
      console.error("Failed to leave league:", err);
      setMembersError(err?.message || "Failed to leave league");
    } finally {
      setLoadingMembers(false);
      setConfirmLeaveOpen(false);
    }
  };

  const handleCancelLeaveLeague = () => {
    setConfirmLeaveOpen(false);
  };

  // Open the custom confirmation modal for deleting
  const handleRequestDeleteLeague = () => {
    if (!selectedLeagueId) return;
    setConfirmDeleteOpen(true);
  };

  const handleDeleteLeague = async () => {
    if (!selectedLeagueId) return;

    try {
      setLoadingMembers(true);
      setMembersError(null);
      await deleteLeague(selectedLeagueId);

      // Remove league locally and reset selection
      setMyLeagues((prev) => prev.filter((l) => l.id !== selectedLeagueId));
      setSelectedLeagueId(null);
      setSelectedLeagueName(null);
      setMembers([]);
    } catch (err: any) {
      console.error("Failed to delete league:", err);
      setMembersError(err?.message || "Failed to delete league");
    } finally {
      setLoadingMembers(false);
      setConfirmDeleteOpen(false);
    }
  };

  const handleCancelDeleteLeague = () => {
    setConfirmDeleteOpen(false);
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
            onClick={logout}
            className="text-sm px-3 py-1 rounded-md border border-slate-600 hover:bg-slate-800"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-4">
        <div className="mb-3">
          <h2 className="text-lg font-semibold mb-2">League info</h2>
          <button
            onClick={() => {
              setShowCreateLeagueForm((prev) => !prev);
              setCreateLeagueError(null);
            }}
            className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm"
          >
            {showCreateLeagueForm ? "Cancel" : "Create league"}
          </button>
        </div>

        {showCreateLeagueForm && (
          <form
            onSubmit={handleCreateLeague}
            autoComplete="off"
            className="mb-3 p-3 rounded-md bg-slate-800 border border-slate-700 space-y-2 max-w-md mx-auto"
          >
            {/* Decoy fields so browsers put saved login info here instead of the real inputs */}
            <input
              type="text"
              name="dummy-league-username"
              autoComplete="username"
              className="hidden"
              tabIndex={-1}
            />
            <input
              type="password"
              name="dummy-league-password"
              autoComplete="current-password"
              className="hidden"
              tabIndex={-1}
            />
			
			<div className="mb-2">
              <span className="block text-xs text-slate-300 mb-1">
                League type
              </span>
              <div className="flex items-center gap-4 text-xs text-slate-200">
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="league-visibility"
                    value="public"
                    className="h-3 w-3"
                    checked={newLeagueVisibility === "public"}
                    onChange={() => {
                      setNewLeagueVisibility("public");
                      // Optional: clear password when switching back to public
                      setNewLeaguePassword("");
                    }}
                  />
                  <span>Public</span>
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="league-visibility"
                    value="private"
                    className="h-3 w-3"
                    checked={newLeagueVisibility === "private"}
                    onChange={() => setNewLeagueVisibility("private")}
                  />
                  <span>Private</span>
                </label>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <div className="flex-1 mb-2 sm:mb-0">
                  <label className="block text-xs text-slate-300 mb-1">
                    League name
                  </label>
                  <input
                    type="text"
                    name="new-league-name"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    readOnly
                    onFocus={(e) => {
                      // Enable typing only after focus; many browsers won't try to autofill this.
                      e.currentTarget.readOnly = false;
                    }}
                    className="w-full text-sm px-2 py-1 rounded-md bg-slate-900 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="Enter league name"
                    value={newLeagueName}
                    onChange={(e) => setNewLeagueName(e.target.value)}
                  />
                </div>
			  
                {newLeagueVisibility === "private" && (
                  <div className="flex-1">
                    <label className="block text-xs text-slate-300 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      name="new-league-password"
                      autoComplete="off"
                      className="w-full text-sm px-2 py-1 rounded-md bg-slate-900 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Enter password"
                      value={newLeaguePassword}
                      onChange={(e) => setNewLeaguePassword(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {createLeagueError && (
              <p className="text-xs text-red-400">{createLeagueError}</p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={creatingLeague}
                className="px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-sm disabled:opacity-60"
              >
                {creatingLeague ? "Creating..." : "Create league"}
              </button>
            </div>
          </form>
        )}


        {/* League selector */}
        {myLeagues.length > 0 && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-slate-300">Select league:</span>
            <select
              className="text-xs px-2 py-1 rounded-md bg-slate-900 border border-slate-600"
              value={selectedLeagueId || ""}
              disabled={isLoadingLeagues}
              onChange={(e) => {
                const value = e.target.value || null;
                setSelectedLeagueId(value);
              }}
            >
              <option value="">-- Choose a league --</option>
              {myLeagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {leaguesError && (
          <p className="text-sm text-red-400">{leaguesError}</p>
        )}

        {!isLoadingLeagues && !leaguesError && myLeagues.length === 0 && (
          <p className="text-sm text-slate-400">
            You are not a member of any league.
          </p>
        )}

        {selectedLeagueId && (
          <>
            {loadingMembers && (
              <p className="text-sm text-slate-300">
                Loading members for this league...
              </p>
            )}

            {membersError && (
              <p className="text-sm text-red-400">{membersError}</p>
            )}

            {!loadingMembers && !membersError && (
              <section className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-semibold">
                    Members
                    {selectedLeagueName ? ` in ${selectedLeagueName}` : ""}
                  </h3>

                  <div className="flex items-center gap-2">
                    {selectedLeagueId && (
                      <button
                        type="button"
                        onClick={() =>
                          navigate("/leaderboard", { state: { leagueId: selectedLeagueId } })
                        }
                        className="text-xs px-3 py-1 rounded-md border border-slate-600 hover:bg-slate-800"
                      >
                        View leaderboard
                      </button>
                    )}
		          
                    {iAmOwner && (
                      <button
                        type="button"
                        onClick={handleRequestDeleteLeague}
                        className="text-xs px-3 py-1 rounded-md bg-red-600 hover:bg-red-500"
                      >
                        Delete league
                      </button>
                    )}
                    {iAmMember && !iAmOwner && (
                      <button
                        type="button"
                        onClick={handleRequestLeaveLeague}
                        className="text-xs px-3 py-1 rounded-md border border-slate-600 hover:bg-slate-800"
                      >
                        Leave league
                      </button>
                    )}
                  </div>
                </div>

                {/* League summary box */}
                <div className="mt-1 rounded-md bg-slate-800/70 border border-slate-700 px-3 py-2 text-xs text-slate-200">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <div>
                      <span className="font-semibold">League:</span>{" "}
                      {selectedLeagueName || "(unnamed)"}
                    </div>
                    <div>
                      <span className="font-semibold">Owner:</span>{" "}
                      {ownerMember?.username || "(unknown)"}
                    </div>
                    <div>
                      <span className="font-semibold">Members:</span>{" "}
                      {memberCount}
                    </div>
                    <div>
                      <span className="font-semibold">With bracket:</span>{" "}
                      {bracketCount}
                    </div>
                    <div>
                      <span className="font-semibold">You:</span>{" "}
                      {iAmOwner
                        ? "Owner"
                        : iAmMember
                        ? "Member"
                        : "Not in this league"}
                    </div>
                  </div>
                </div>

                {members.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    This league has no members yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-800/70 border-b border-slate-700">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-xs text-slate-300">
                            Username
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-xs text-slate-300">
                            Role
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-xs text-slate-300">
                            Joined at
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-xs text-slate-300">
                            Bracket
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m) => (
                          <tr
                            key={m.user_id}
                            className="border-b border-slate-800 last:border-b-0"
                          >
                            <td className="px-3 py-2">
                              {m.username || "(no username)"}
                            </td>
                            <td className="px-3 py-2 text-slate-300">
                              {m.is_owner ? "Owner" : "Member"}
                            </td>
                            <td className="px-3 py-2 text-slate-300 text-xs">
                              {m.joined_at
                                ? new Date(m.joined_at).toLocaleString()
                                : "—"}
                            </td>
                          <td className="px-3 py-2 text-slate-300 text-xs">
                            {m.has_bracket && m.bracket_id ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/bracket/${m.bracket_id}`)}
                                className="text-xs px-2 py-1 rounded-md border border-slate-600 hover:bg-slate-800"
                              >
                                View bracket
                              </button>
                            ) : (
                              "No bracket yet"
                            )}
                          </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
	  <Footer />
	  {/* Custom confirmation modal for leaving a league */}
      {confirmLeaveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-xl bg-slate-800 border border-slate-700 p-5 shadow-xl">
            <h4 className="text-lg font-semibold mb-2">Leave league?</h4>
            <p className="text-sm text-slate-300 mb-4">
              You are about to leave "{selectedLeagueDisplayName}". You will be
              removed from this league&apos;s standings.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelLeaveLeague}
                className="px-3 py-1 text-sm rounded-md border border-slate-600 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveLeague}
                disabled={loadingMembers}
                className="px-3 py-1 text-sm rounded-md bg-red-600 hover:bg-red-500 text-white disabled:opacity-60"
              >
                {loadingMembers ? "Leaving..." : "Leave league"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom confirmation modal for deleting a league */}
      {confirmDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-xl bg-slate-800 border border-slate-700 p-5 shadow-xl">
            <h4 className="text-lg font-semibold mb-2">Delete league?</h4>
            <p className="text-sm text-slate-300 mb-4">
              This will permanently delete "{selectedLeagueDisplayName}" from
              NBACorner. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelDeleteLeague}
                className="px-3 py-1 text-sm rounded-md border border-slate-600 hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteLeague}
                disabled={loadingMembers}
                className="px-3 py-1 text-sm rounded-md bg-red-600 hover:bg-red-500 text-white disabled:opacity-60"
              >
                {loadingMembers ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};