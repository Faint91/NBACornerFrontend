import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";

const primaryAction = "inline-flex min-h-11 items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300";
const dailyAction = "inline-flex min-h-11 items-center justify-center rounded-md bg-orange-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-300";

export function HomePage() {
  const { authReady, token, user } = useAuth();
  const { hash } = useLocation();
  const brackets = useRef<HTMLElement>(null);

  useEffect(() => {
    if (hash === "#brackets") brackets.current?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <Header homeBrand sessionBehavior="sign-in-or-logout" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <section aria-labelledby="home-title" className="rounded-2xl border border-slate-700 bg-slate-950/85 px-6 py-10 sm:px-10 sm:py-14">
          <img src="/icon2.png" alt="" width={64} height={64} className="mb-5 rounded-xl" />
          <h1 id="home-title" className="text-4xl font-bold tracking-tight sm:text-5xl">NBA Corner</h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Predict the NBA playoffs with friends, or guess today’s players and pick a winner in Daily 1on1.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/1on1" className={dailyAction}>Play Today’s 1on1</a>
            <a href="#brackets" className="inline-flex min-h-11 items-center rounded-md border border-slate-600 px-4 py-2 text-sm font-semibold hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300">
              Explore Playoff Brackets
            </a>
          </div>
        </section>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <section aria-labelledby="daily-title" className="rounded-xl border border-slate-700 bg-slate-900/85 p-6">
            <h2 id="daily-title" className="text-2xl font-semibold">Daily 1on1</h2>
            <p className="mt-3 text-slate-300">
              Use hints to identify two NBA player seasons, then vote for the one you think would win. Play without an account.
            </p>
            <a href="/1on1" className={dailyAction + " mt-5"}>Play Today’s 1on1</a>
          </section>

          <section id="brackets" ref={brackets} aria-labelledby="brackets-title" className="scroll-mt-4 rounded-xl border border-slate-700 bg-slate-900/85 p-6">
            <h2 id="brackets-title" className="text-2xl font-semibold">NBA Playoff Brackets</h2>
            <p className="mt-3 text-slate-300">
              Create and manage your NBA playoff predictions, join leagues with friends, and follow the leaderboards.
            </p>
            <div className="mt-5 flex min-h-11 flex-wrap items-center gap-3">
              {authReady && (token && user ? (
                <Link to="/dashboard" className={primaryAction}>Go to Dashboard</Link>
              ) : (
                <>
                  <Link to="/login" className={primaryAction}>Sign In</Link>
                  <Link to="/register" className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-indigo-200 underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300">
                    Create Account
                  </Link>
                </>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
