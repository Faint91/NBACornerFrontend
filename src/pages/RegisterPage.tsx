import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (password !== passwordConfirm) {
      setStatus("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const resp = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          username,
          password,
        }),
      });

      const data = await resp.json();

      if (!resp.ok) {
        setStatus(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      // ✅ On success, send them to login with a flag + email prefilled
	  trackEvent("sign_up", { method: "password" });
      navigate("/login", {
        state: { registered: true, email },
        replace: true,
      });
    } catch (err) {
      console.error(err);
      setStatus("Network error");
    } finally {
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
            Free NBA playoff game
          </div>
          <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight mb-4">
            Create your{" "}
            <span className="text-indigo-400">NBA Corner</span> account
          </h1>
          <p className="text-sm lg:text-base text-slate-300 max-w-xl">
            Sign up once and use the same account every season to build your
            brackets, join leagues and track your results.
          </p>
        </div>
  
        {/* Mobile register panel (between hero text and feature cards) */}
        <div className="mt-6 lg:hidden">
          <div className="w-full max-w-md mx-auto rounded-2xl border border-slate-800 bg-slate-900/80 px-6 py-7 shadow-xl shadow-black/40">
            <div className="mb-5">
              <h2 className="text-xl font-semibold tracking-tight">
                Sign up to start playing
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Create an account to build brackets, join leagues and follow
                leaderboards.
              </p>
            </div>
  
            {status && (
              <div className="mb-4 rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100">
                {status}
              </div>
            )}
  
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
  
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
  
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div>
                  <label className="block text-xs font-medium text-slate-200 mb-1">
                    Confirm password
                  </label>
                  <input
                    type="password"
                    className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    required
                  />
                </div>
              </div>
  
              <p className="text-[11px] text-slate-500">
                By creating an account you agree to play nicely, respect other
                users, and not blame us if your team gets swept in the first
                round.
              </p>
  
              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-md bg-indigo-600 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-60"
              >
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>
  
            <p className="mt-4 text-center text-xs text-slate-400">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="text-indigo-300 hover:underline"
              >
                Log in
              </button>
            </p>
          </div>
        </div>
  
        {/* Feature cards */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl text-sm">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-lg mb-1">🚀 Quick setup</div>
            <p className="text-slate-300 text-xs">
              It only takes a minute. No spam, no newsletters, just your
              playoff brackets.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-lg mb-1">📱 Play with friends</div>
            <p className="text-slate-300 text-xs">
              Compete in private leagues, compare picks and trash talk in your
              group chats.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-lg mb-1">📈 Track your history</div>
            <p className="text-slate-300 text-xs">
              See how you did in previous seasons and chase that perfect
              bracket.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-lg mb-1">🔒 Your picks, your data</div>
            <p className="text-slate-300 text-xs">
              We only store what we need to run the game: your account and your
              brackets.
            </p>
          </div>
        </div>
      </div>
  
      {/* Right auth form panel - desktop only */}
      <div className="order-2 lg:order-2 hidden lg:flex flex-1 items-center justify-center px-4 py-8 lg:px-8 lg:py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 px-6 py-7 shadow-xl shadow-black/40">
          <div className="mb-5">
            <h2 className="text-xl font-semibold tracking-tight">
              Sign up to start playing
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Create an account to build brackets, join leagues and follow
              leaderboards.
            </p>
          </div>
  
          {status && (
            <div className="mb-4 rounded-md border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-100">
              {status}
            </div>
          )}
  
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Email
              </label>
              <input
                type="email"
                className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
  
            <div>
              <label className="block text-xs font-medium text-slate-200 mb-1">
                Username
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose something fun"
                required
              />
            </div>
  
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div>
                <label className="block text-xs font-medium text-slate-200 mb-1">
                  Confirm password
                </label>
                <input
                  type="password"
                  className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                />
              </div>
            </div>
  
            <p className="text-[11px] text-slate-500">
              By creating an account you agree to play nicely, respect other
              users, and not blame us if your team gets swept in the first
              round.
            </p>
  
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-md bg-indigo-600 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
  
          <p className="mt-4 text-center text-xs text-slate-400">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-indigo-300 hover:underline"
            >
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
