// src/pages/FaqsPage.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Footer } from "../components/layout/Footer";

export const FaqsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const handleNavClick = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false); // close menu after navigating
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col">
      {/* Header (same style as other pages) */}
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
      <main className="flex-1 p-6 space-y-6 max-w-4xl mx-auto text-slate-100">
        <header className="space-y-1">
          <h2 className="text-xl font-semibold">Frequently Asked Questions</h2>
          <p className="text-sm text-slate-300">
            Answers to the most common questions about brackets, leagues, and scoring on NBA Corner.
          </p>
        </header>

        {/* Brackets & Leagues */}
        <section className="space-y-4">
          <h3 className="text-base font-semibold text-slate-100">
            Brackets &amp; Leagues
          </h3>
          <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
            {/* Why I can't create a bracket? */}
            <div>
              <h4 className="font-semibold text-slate-100">
                Why can&apos;t I create a bracket?
              </h4>
              <p>
                Brackets can only be created when the season is in the{" "}
                <span className="font-semibold">prediction window</span>. This is
                the period after we know the final playoff/play-in matchups and
                before the first game of the postseason has started.
              </p>
              <p className="mt-1">
                If you don&apos;t see the option to create a bracket, it usually
                means either:
              </p>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li>
                  The play-in and playoff matchups are not fully confirmed yet, or
                </li>
                <li>
                  The prediction window has closed because games have already started.
                </li>
              </ul>
              <p className="mt-1">
                Once the first game begins, brackets are{" "}
                <span className="font-semibold">locked</span> and you can no
                longer create or edit them.
              </p>
            </div>

            {/* Do I need to pick games for the play-in tournament? */}
            <div>
              <h4 className="font-semibold text-slate-100">
                Do I need to pick games for the play-in tournament?
              </h4>
              <p>
                Yes. The play-in tournament is part of your bracket, and you are
                expected to make picks for those games as well.
              </p>
              <p className="mt-1">
                Play-in games are scored differently from the main playoff
                series: they are usually{" "}
                <span className="font-semibold">worth fewer points</span> per
                correct prediction than later rounds. This lets you earn some
                points early without letting the play-in completely decide the
                contest.
              </p>
              <p className="mt-1">
                You can always check the detailed scoring breakdown on the
                leaderboards page.
              </p>
            </div>

            {/* What's the deadline for bracket entries? */}
            <div>
              <h4 className="font-semibold text-slate-100">
                What&apos;s the deadline for bracket entries?
              </h4>
              <p>
                The deadline for entering and editing your bracket is{" "}
                <span className="font-semibold">
                  right before the first postseason game tips off
                </span>{" "}
                (including the play-in tournament).
              </p>
              <p className="mt-1">
                Until that moment, you can create a new bracket and adjust your
                picks. As soon as the first game starts, all brackets are{" "}
                <span className="font-semibold">locked</span> and you can no
                longer change any predictions.
              </p>
            </div>

            {/* Why am I no longer in this league? */}
            <div>
              <h4 className="font-semibold text-slate-100">
                Why am I no longer in this league?
              </h4>
              <p>
                If you were in a league and suddenly don&apos;t see it anymore,
                there are two main possibilities:
              </p>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li>
                  <span className="font-semibold">The league owner removed you</span>{" "}
                  from the league (kicked you out), or
                </li>
                <li>
                  <span className="font-semibold">The league was deleted</span>{" "}
                  by its owner.
                </li>
              </ul>
              <p className="mt-1">
                If a league is deleted, it disappears for everyone. Your bracket
                itself can still exist and appear in the global leaderboard, but
                it will no longer be associated with that specific league.
              </p>
              <p className="mt-1">
                If you think this was a mistake, the best option is to contact
                the league owner directly or reach out to us at{" "}
                <a
                  href="mailto:admin@nbacorner.com"
                  className="text-indigo-300 hover:text-indigo-200 underline"
                >
                  admin@nbacorner.com
                </a>
                .
              </p>
            </div>

            {/* Can I edit my bracket after I create it? */}
            <div>
              <h4 className="font-semibold text-slate-100">
                Can I edit my bracket after I create it?
              </h4>
              <p>
                Yes. You can edit your bracket as many times as you want{" "}
                <span className="font-semibold">
                  until the first postseason game tips off
                </span>
                . After that, all brackets are locked and no further changes are
                allowed.
              </p>
            </div>

            {/* Can I join multiple leagues with the same bracket? */}
            <div>
              <h4 className="font-semibold text-slate-100">
                Can I join multiple leagues with the same bracket?
              </h4>
              <p>
                Yes. A single bracket can participate in multiple leagues at the
                same time. This allows you to compete against different groups
                of friends while using the same predictions.
              </p>
            </div>

            {/* Is NBA Corner affiliated with the NBA? */}
            <div>
              <h4 className="font-semibold text-slate-100">
                Is NBA Corner affiliated with the NBA?
              </h4>
              <p>
                No. NBA Corner is an independent project and is{" "}
                <span className="font-semibold">
                  not affiliated with, endorsed by, or sponsored by
                </span>{" "}
                the National Basketball Association (NBA), any NBA team, or any
                related organization. All team names and logos belong to their
                respective owners and are used for descriptive purposes only.
              </p>
            </div>
          </div>
        </section>

        {/* Scoring */}
        <section className="space-y-4">
          <h3 className="text-base font-semibold text-slate-100">
            Scoring &amp; Tiebreakers
          </h3>
          <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
            {/* How does the scoring work? */}
            <div>
              <h4 className="font-semibold text-slate-100">
                How does the scoring work?
              </h4>
              <p>
                Here&apos;s how points are awarded on NBA Corner:
              </p>
              <ul className="list-disc list-inside space-y-1 mt-1">
                <li>
                  <span className="font-semibold">Play-in games: </span>  
                  guessing the winning team = <span className="font-semibold">1 point</span>.
                </li>
                <li>
                  <span className="font-semibold">Playoff series:</span>
                  <ul className="list-disc list-inside ml-4 space-y-1 mt-1">
                    <li>
                      Guessing the <span className="font-semibold">winning team</span> ={" "}
                      <span className="font-semibold">1 point</span>.
                    </li>
                    <li>
                      Guessing the <span className="font-semibold">winning team, losing team, and series length</span>{" "}
                      = <span className="font-semibold">3 points total</span>.
                    </li>
                  </ul>
                </li>
                <li>
                  <span className="font-semibold">NBA Finals:</span>
                  <ul className="list-disc list-inside ml-4 space-y-1 mt-1">
                    <li>
                      Guessing the <span className="font-semibold">two finalists</span> that reach the Finals ={" "}
                      <span className="font-semibold">1 point</span>.
                    </li>
                    <li>
                      Guessing the <span className="font-semibold">NBA champion</span> ={" "}
                      <span className="font-semibold">3 points</span>.
                    </li>
                  </ul>
                </li>
              </ul>
              <p className="mt-2">
                This structure rewards both accurate early predictions and nailing
                the deeper rounds and the champion. You can always see the exact
                scoring breakdown on the leaderboards page.
              </p>
            </div>


            {/* What happens if there is a tie? */}
            <div>
              <h4 className="font-semibold text-slate-100">
                What happens if there is a tie?
              </h4>
              <p>
                If two or more brackets finish with the same total number of
                points, they are considered{" "}
                <span className="font-semibold">tied</span> in the standings.
                The tiebreaker will be decided by who has more <span className="font-semibold">full hits</span>.
				If there is still a tie, the bracket that was created earlier will win the competition.
              </p>
            </div>
          </div>
        </section>

        {/* Need more help */}
        <section className="space-y-2 text-sm text-slate-300 leading-relaxed">
          <h3 className="text-base font-semibold text-slate-100">
            Still need help?
          </h3>
          <p>
            If you can&apos;t find the answer you&apos;re looking for, feel free
            to contact us at{" "}
            <a
              href="mailto:admin@nbacorner.com"
              className="text-indigo-300 hover:text-indigo-200 underline"
            >
              admin@nbacorner.com
            </a>
            . We&apos;ll get back to you as soon as we can.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
};
