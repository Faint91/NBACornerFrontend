import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const API_URL = import.meta.env.VITE_API_URL;

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState(() => {
    const state = location.state as any;
    return state?.email || "";
  });
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fromRegister = (location.state as any)?.registered;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);

    try {
      const trimmed = identifier.trim();
      const payload: Record<string, string> = { password };

      if (trimmed.includes("@")) {
        payload.email = trimmed;
      } else {
        payload.username = trimmed;
      }

      const resp = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setStatus(data.error || "Login failed");
        setLoading(false);
        return;
      }

      // ✅ Save auth + go to dashboard
      login({ token: data.token, user: data.user });
      setStatus("Login successful");
      setLoading(false);
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setStatus("Network error");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-x-hidden text-slate-100 flex flex-col lg:flex-row">
      {/* Left marketing panel */}
      <div className="order-1 lg:order-1 flex-1 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-8 lg:px-12 lg:py-12">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/40 bg-indigo-500/5 px-3 py-1 text-[11px] font-medium text-indigo-200 mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Live NBA playoff brackets
          </div>
          <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight mb-4">
            Welcome to{" "}
            <span className="text-indigo-400">NBA Corner</span>
          </h1>
          <p className="text-sm lg:text-base text-slate-300 max-w-xl">
            Create your NBA playoff bracket, join private leagues with your
            friends, and follow live leaderboards round by round.
          </p>
        </div>
  
        {/* Mobile login panel (between hero text and feature cards) */}
        <div className="mt-6 lg:hidden">
          <div className="w-full max-w-md mx-auto rounded-2xl border border-slate-800 bg-slate-900/80 px-6 py-7 shadow-xl shadow-black/40">
            <div className="mb-5">
              <h2 className="text-xl font-semibold tracking-tight">
                Log in to your account
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Use your email or username and password to access NBA Corner.
              </p>
            </div>
  
            {fromRegister && !status && (
              <div className="mb-4 rounded-md border border-emerald-500/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
                Account created successfully. You can now log in.
              </div>
            )}
  
            {status && (
              <div className="mb-4 rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100">
                {status}
              </div>
            )}
  
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">
                  Email or username
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@example.com or username"
                  required
                />
              </div>
  
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
  
              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-md bg-indigo-600 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-60"
              >
                {loading ? "Logging in..." : "Log in"}
              </button>
              <p className="mt-3 text-xs text-slate-400 text-center">
                Have you forgotten your password?{" "}
                <Link
                  to="/reset-password"
                  className="text-indigo-300 hover:text-indigo-200"
                >
                  Reset it
                </Link>
              </p>
            </form>
  
            <p className="mt-4 text-center text-xs text-slate-400">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/register")}
                className="text-indigo-300 hover:underline"
              >
                Sign up for free
              </button>
            </p>
          </div>
        </div>
  
        {/* Feature cards */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl text-sm">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-lg mb-1">🏆 Bracket challenge</div>
            <p className="text-slate-300 text-xs">
              Predict every series of the NBA playoffs and see how your bracket
              scores against others.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-lg mb-1">👥 Private leagues</div>
            <p className="text-slate-300 text-xs">
              Create or join leagues with friends and coworkers. Compete on
              custom leaderboards.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-lg mb-1">📊 Live standings</div>
            <p className="text-slate-300 text-xs">
              Leaderboards update as games are played, with per-series scoring.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-lg mb-1">🕒 Season history</div>
            <p className="text-slate-300 text-xs">
              Browse past seasons and see how your brackets finished in previous
              years.
            </p>
          </div>
        </div>
  
        <p className="mt-6 text-[11px] text-slate-500">
          Log in to continue where you left off, or create a free account to
          start your first bracket.
        </p>
      </div>
  
      {/* Right auth form panel - desktop only */}
      <div className="order-2 lg:order-2 hidden lg:flex flex-1 items-center justify-center px-4 py-8 lg:px-8 lg:py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 px-6 py-7 shadow-xl shadow-black/40">
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-tight">
              Log in to your account
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Use your email or username and password to access NBA Corner.
            </p>
          </div>
  
          {fromRegister && !status && (
            <div className="mb-4 rounded-md border border-emerald-500/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
              Account created successfully. You can now log in.
            </div>
          )}
  
          {status && (
            <div className="mb-4 rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100">
              {status}
            </div>
          )}
  
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Email or username
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com or username"
                required
              />
            </div>
  
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Password
              </label>
              <input
                type="password"
                className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
  
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-md bg-indigo-600 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-60"
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
            <p className="mt-3 text-xs text-slate-400 text-center">
              Have you forgotten your password?{" "}
              <Link
                to="/reset-password"
                className="text-indigo-300 hover:text-indigo-200"
              >
                Reset it
              </Link>
            </p>
          </form>
  
          <p className="mt-4 text-center text-xs text-slate-400">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="text-indigo-300 hover:underline"
            >
              Sign up for free
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};