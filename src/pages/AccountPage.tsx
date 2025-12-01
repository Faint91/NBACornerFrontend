// src/pages/AccountPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../api/client";
import { useLeaguesApi } from "../api/leagues";
import type { LeagueSummary } from "../api/leagues";
import { Footer } from "../components/layout/Footer";

type MyBracketSummary = {
  bracket_id: string;
  name?: string | null;
  created_at: string | null;
  saved_at: string | null;
  is_done?: boolean;
};

type MyBracketEnvelope = {
  bracket: MyBracketSummary | null;
};

export const AccountPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { get, post } = useApi();
  const { getAllLeagues } = useLeaguesApi();

  const [bracket, setBracket] = useState<MyBracketSummary | null>(null);
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const memberSince = useMemo(() => {
    if (!user?.created_at) return null;
    const d = new Date(user.created_at);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }, [user?.created_at]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [bracketRaw, allLeagues] = await Promise.all([
          get("/brackets/me").catch(() => null),
          getAllLeagues().catch(() => [] as LeagueSummary[]),
        ]);

        if (cancelled) return;

        let myBracket: MyBracketSummary | null = null;
        if (bracketRaw && typeof bracketRaw === "object") {
          const env = bracketRaw as MyBracketEnvelope;
          myBracket = env.bracket ?? null;
        }

        // Only keep leagues where the user is a member
        const myLeagues = (allLeagues || []).filter(
          (l) => l.is_member === true
        );

        setBracket(myBracket);
        setLeagues(myLeagues);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Failed to load account information.");
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

  // Public = requires_password === false
  const publicLeagues = useMemo(
    () => leagues.filter((l) => l.requires_password === false),
    [leagues]
  );

  // Private = everything else
  const privateLeagues = useMemo(
    () => leagues.filter((l) => l.requires_password !== false),
    [leagues]
  );

  const handleResetPassword = async () => {
    if (!user?.email) return;

    try {
      setResetLoading(true);
      setResetError(null);
      setResetMessage(null);

      await post("/auth/forgot-password", { email: user.email });

      setResetMessage(
        "If an account exists with this email, we've sent instructions to reset your password."
      );
    } catch (err: any) {
      setResetError(err?.message || "Failed to start password reset.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col">
      {/* Top header / nav */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-xl font-semibold tracking-tight hover:text-slate-100"
          >
            NBA Corner
          </button>

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
              Signed in as{" "}
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

      {/* Main content */}
      <main className="flex-1 p-6 max-w-5xl mx-auto">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 space-y-6 shadow-sm shadow-slate-900/70">
          {/* Header */}
          <section className="space-y-1">
            <h1 className="text-xl font-semibold">Account</h1>
            {memberSince && (
              <p className="text-xs text-slate-400">
                Member since: {memberSince}
              </p>
            )}
          </section>

          {error && (
            <div className="rounded-md border border-red-500/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          {/* Profile */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Profile</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1 text-sm">
                <p className="text-slate-400">Username</p>
                <p className="font-medium">{user?.username || "-"}</p>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-slate-400">Email</p>
                <p className="font-medium break-all">{user?.email || "-"}</p>
              </div>
            </div>
          </section>

          {/* Security / reset password */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Security</h2>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm">
              <div className="space-y-1">
                <p className="font-medium">Reset password</p>
                <p className="text-xs text-slate-400">
                  We&apos;ll send a reset link to your account email:{" "}
                  <span className="font-semibold">{user?.email}</span>
                </p>
                {resetError && (
                  <p className="text-xs text-red-400 mt-1">
                    {resetError}
                  </p>
                )}
                {resetMessage && (
                  <p className="text-xs text-emerald-400 mt-1">
                    {resetMessage}
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={resetLoading || !user?.email}
                onClick={handleResetPassword}
                className="self-start text-xs px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {resetLoading ? "Sending..." : "Send reset email"}
              </button>
            </div>
          </section>

          {/* Bracket */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Bracket</h2>
            {loading && !bracket && (
              <p className="text-sm text-slate-400">Loading bracket info...</p>
            )}
            {!loading && !bracket && (
              <p className="text-sm text-slate-400">
                You don&apos;t have a bracket for the current season yet.
              </p>
            )}
            {bracket && (
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-sm flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {bracket.name || "My bracket"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Created at:{" "}
                    {bracket.created_at
                      ? new Date(bracket.created_at).toLocaleString()
                      : "-"}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/bracket/${bracket.bracket_id}`)}
                  className="text-xs px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500"
                >
                  View bracket
                </button>
              </div>
            )}
          </section>

          {/* Leagues */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Leagues</h2>
            {loading && leagues.length === 0 && (
              <p className="text-sm text-slate-400">Loading your leagues...</p>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {/* Public */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-200">
                  Public leagues
                </h3>
                {publicLeagues.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    You&apos;re not in any public leagues yet.
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {publicLeagues.map((league) => (
                      <li
                        key={league.id}
                        className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-medium">
                            {league.name || "Unnamed league"}
                          </p>
                          {league.joined_at && (
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Joined:{" "}
                              {new Date(
                                league.joined_at
                              ).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() =>
                            navigate("/leagues/info", {
                              state: { leagueId: league.id },
                            })
                          }
                          className="text-[11px] px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700"
                        >
                          View
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Private */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-200">
                  Private leagues
                </h3>
                {privateLeagues.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    You&apos;re not in any private leagues yet.
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {privateLeagues.map((league) => (
                      <li
                        key={league.id}
                        className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2 flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-medium">
                            {league.name || "Unnamed league"}
                          </p>
                          {league.joined_at && (
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Joined:{" "}
                              {new Date(
                                league.joined_at
                              ).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() =>
                            navigate("/leagues/info", {
                              state: { leagueId: league.id },
                            })
                          }
                          className="text-[11px] px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700"
                        >
                          View
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};
