import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useApi } from "../api/client";
import { Footer } from "../components/layout/Footer";


const SuccessMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mt-3 rounded-md border border-emerald-500/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
    {children}
  </div>
);

const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  confirmVariant?: "primary" | "danger";
}> = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  confirmVariant = "primary",
}) => {
  if (!open) return null;

  const confirmClasses =
    confirmVariant === "danger"
      ? "bg-red-600 hover:bg-red-500"
      : "bg-indigo-600 hover:bg-indigo-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-xl bg-slate-800 border border-slate-700 p-5 shadow-xl">
        <h4 className="text-lg font-semibold mb-2">{title}</h4>
        <div className="text-sm text-slate-300 mb-4">{description}</div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-sm rounded-md border border-slate-600 hover:bg-slate-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3 py-1 text-sm rounded-md text-white ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

type SnapshotResponse = {
  ok?: boolean;
  season_id?: string;
  season_code?: string;
  rows_snapshot?: number;
  history_snapshot_id?: string | null;
  history_rows_count?: number;
  error?: string;
  status?: number;
};

type RolloverStep = {
  step?: string;
  ok?: boolean;
  message?: string;
};

type RolloverResponse = {
  ok?: boolean;
  status?: number;
  error?: string;
  current_season?: {
    id?: string;
    code?: string;
  };
  new_season?: {
    id?: string;
    code?: string;
    regular_season_end_utc?: string | null;
    playoffs_start_utc?: string | null;
  };
  steps?: RolloverStep[];
  env_next_actions?: {
    message?: string;
    CURRENT_SEASON_CODE?: string | null;
    REGULAR_SEASON_END_UTC?: string | null;
    PLAYOFFS_START_UTC?: string | null;
  };
};

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { post } = useApi();

  // --- shared bits ---

  const isAdmin = !!user?.is_admin;

  // Frontend current season code (from env, for hints / confirmations)
  const CURRENT_SEASON_CODE = (
    import.meta.env.VITE_CURRENT_SEASON_CODE ||
    import.meta.env.VITE_CURRENT_SEASON ||
    ""
  )
    .trim()
    .toLowerCase();

  // --- snapshot state ---
  const [snapshotConfirmOpen, setSnapshotConfirmOpen] = useState(false);
  const [rolloverConfirmOpen, setRolloverConfirmOpen] = useState(false);
  const [seasonCodeConfirm, setSeasonCodeConfirm] = useState("");
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshotResult, setSnapshotResult] = useState<SnapshotResponse | null>(
    null
  );

  // --- rollover state ---

  const [newSeasonCode, setNewSeasonCode] = useState("");
  const [regSeasonEnd, setRegSeasonEnd] = useState("");
  const [playoffsStart, setPlayoffsStart] = useState("");
  const [rolloverLoading, setRolloverLoading] = useState(false);
  const [rolloverError, setRolloverError] = useState<string | null>(null);
  const [rolloverResult, setRolloverResult] = useState<RolloverResponse | null>(
    null
  );

  // Second: actual API call, triggered from ConfirmDialog
  const runSnapshot = async () => {
    if (!user || !user.is_admin) return;

    setSnapshotLoading(true);
    setSnapshotError(null);
    setSnapshotResult(null);

    try {
      const resp = (await post(
        "/admin/leaderboard/snapshot",
        {}
      )) as SnapshotResponse;
      setSnapshotResult(resp);
    } catch (err: any) {
      const msg =
        err && typeof err.message === "string"
          ? err.message
          : "Failed to create snapshot.";
      setSnapshotError(msg);
    } finally {
      setSnapshotLoading(false);
    }
  };

  const runRollover = async () => {
    if (!user || !user.is_admin) return;

    const trimmedNewCode = newSeasonCode.trim();

    setRolloverLoading(true);
    setRolloverError(null);
    setRolloverResult(null);

    const payload: any = {
      new_season_code: trimmedNewCode,
    };
    if (regSeasonEnd.trim()) {
      payload.regular_season_end_utc = regSeasonEnd.trim();
    }
    if (playoffsStart.trim()) {
      payload.playoffs_start_utc = playoffsStart.trim();
    }

    try {
      const resp = (await post(
        "/admin/season/rollover",
        payload
      )) as RolloverResponse;
      setRolloverResult(resp);
    } catch (err: any) {
      const msg =
        err && typeof err.message === "string"
          ? err.message
          : "Failed to run season rollover.";
      setRolloverError(msg);
    } finally {
      setRolloverLoading(false);
    }
  };

  // Gate: Only admins can stay on this page
  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    if (!user.is_admin) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // -------- SNAPSHOT HANDLER --------

  const handleSnapshot = () => {
    if (!user || !user.is_admin) return;

    // Safety: require correct current season code typed
    if (
      !CURRENT_SEASON_CODE ||
      seasonCodeConfirm.trim().toLowerCase() !== CURRENT_SEASON_CODE
    ) {
      setSnapshotError(
        "To confirm, please type the current season code exactly as shown."
      );
      return;
    }

    // Open custom confirm dialog (no more window.confirm)
    setSnapshotConfirmOpen(true);
  };

  const snapshotDisabledReason = (() => {
    if (!user || !user.is_admin) {
      return "Only admins can use this action.";
    }
    if (!CURRENT_SEASON_CODE) {
      return "CURRENT_SEASON_CODE is not configured in the frontend env.";
    }
    if (seasonCodeConfirm.trim().toLowerCase() !== CURRENT_SEASON_CODE) {
      return "Type the current season code to enable the button.";
    }
    return null;
  })();

  // -------- ROLLOVER HANDLER --------

  const handleRollover = () => {
    if (!user || !user.is_admin) return;

    const trimmedNewCode = newSeasonCode.trim();
    if (!trimmedNewCode) {
      setRolloverError("New season code is required.");
      return;
    }

    if (
      CURRENT_SEASON_CODE &&
      trimmedNewCode.toLowerCase() === CURRENT_SEASON_CODE
    ) {
      setRolloverError(
        "New season code must be different from the current season code."
      );
      return;
    }

    // Open custom confirm dialog (no more window.confirm)
    setRolloverConfirmOpen(true);
  };

  const rolloverDisabledReason = (() => {
    if (!user || !user.is_admin) {
      return "Only admins can use this action.";
    }
    if (!CURRENT_SEASON_CODE) {
      return "CURRENT_SEASON_CODE is not configured in the frontend env.";
    }
    if (!newSeasonCode.trim()) {
      return "Enter the NEW season code to enable the button.";
    }
    if (
      CURRENT_SEASON_CODE &&
      newSeasonCode.trim().toLowerCase() === CURRENT_SEASON_CODE
    ) {
      return "New season code must be different from the current season code.";
    }
    return null;
  })();

  // -------- RENDER --------

  return (
    <div className="min-h-screen text-slate-100 flex flex-col">
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
            {isAdmin && (
              <button
                onClick={() => navigate("/admin")}
                className="text-sm px-3 py-1 rounded-md border border-indigo-500 bg-indigo-600/20 text-indigo-200"
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
              {isAdmin && (
                <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300 border border-emerald-500/30">
                  Admin
                </span>
              )}
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

      <main className="flex-1 p-6 space-y-8">
        {/* --- Section 1: Snapshot current season --- */}
        <section className="max-w-3xl mx-auto rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-sm shadow-slate-900/60">
          <h2 className="text-xl font-semibold mb-2">
            Snapshot current season leaderboard
          </h2>
          <p className="text-sm text-slate-300 mb-4">
            This will create a frozen snapshot of the{" "}
            <span className="font-semibold">global leaderboard</span> for the{" "}
            <span className="font-mono">
              {CURRENT_SEASON_CODE || "??-??"}
            </span>{" "}
            season. The snapshot fills the{" "}
            <span className="font-semibold">Past Seasons</span> view and should
            only be run when all scores are final.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Type the current season code to confirm
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={
                    CURRENT_SEASON_CODE
                      ? `e.g. ${CURRENT_SEASON_CODE}`
                      : "e.g. 2024-25"
                  }
                  value={seasonCodeConfirm}
                  onChange={(e) => setSeasonCodeConfirm(e.target.value)}
                />
                {CURRENT_SEASON_CODE && (
                  <span className="text-[11px] text-slate-400">
                    Current:{" "}
                    <span className="font-mono">
                      {CURRENT_SEASON_CODE}
                    </span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSnapshot}
                disabled={snapshotLoading || !!snapshotDisabledReason}
                className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-sm font-medium"
              >
                {snapshotLoading ? "Creating snapshot..." : "Create snapshot"}
              </button>
              {snapshotDisabledReason && (
                <span className="text-xs text-slate-400 max-w-md">
                  {snapshotDisabledReason}
                </span>
              )}
            </div>

            {snapshotError && (
              <div className="rounded-md border border-red-500/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                {snapshotError}
              </div>
            )}

            {snapshotResult && snapshotResult.ok && (
              <SuccessMessage>
                <div className="font-semibold mb-0.5">
                  Snapshot created successfully.
                </div>
                <div>
                  Season:{" "}
                  <span className="font-mono">
                    {snapshotResult.season_code ??
                      CURRENT_SEASON_CODE ??
                      "unknown"}
                  </span>
                </div>
                <div>
                  Rows in legacy history:{" "}
                  <span className="font-mono">
                    {snapshotResult.rows_snapshot ?? 0}
                  </span>
                </div>
                <div>
                  Past Seasons snapshot id:{" "}
                  <span className="font-mono">
                    {snapshotResult.history_snapshot_id ?? "n/a"}
                  </span>{" "}
                  ({snapshotResult.history_rows_count ?? 0} rows)
                </div>
              </SuccessMessage>
            )}

            {snapshotResult && !snapshotResult.ok && (
              <div className="rounded-md border border-amber-500/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-100 space-y-1">
                <div className="font-semibold">
                  Snapshot request completed but did not report success.
                </div>
                {snapshotResult.error && <div>{snapshotResult.error}</div>}
                {typeof snapshotResult.status === "number" && (
                  <div>Status: {snapshotResult.status}</div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* --- Section 2: Full end-of-season rollover --- */}
        <section className="max-w-3xl mx-auto rounded-xl border border-red-800/70 bg-[#1A1424] p-6 shadow-sm shadow-red-900/40">
          <h2 className="text-xl font-semibold mb-2">
            End current season &amp; start a new one
          </h2>
          <p className="text-sm text-slate-200 mb-4">
            This will{" "}
            <span className="font-semibold text-red-200">
              snapshot the current global leaderboard, delete all matches and
              scores for the current season, soft-delete its brackets, and
              create a new season row
            </span>
            . Use this only once per season, when everything is final.
          </p>

          <div className="space-y-4">
            <div className="text-xs text-slate-300 border border-slate-800/80 rounded-md p-3 bg-slate-950/40">
              <div>
                <span className="font-semibold">Current season (env):</span>{" "}
                <span className="font-mono">
                  {CURRENT_SEASON_CODE || "not set"}
                </span>
              </div>
              <div className="mt-1">
                The backend will resolve the season being closed from its
                CURRENT_SEASON_* env vars. The new season code you enter below
                will be used only for the new row in the{" "}
                <span className="font-mono">seasons</span> table.
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                New season code (required)
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
                placeholder="e.g. 2026-27"
                value={newSeasonCode}
                onChange={(e) => setNewSeasonCode(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Regular season end (UTC, optional)
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="e.g. 2026-04-15T07:00:00Z"
                  value={regSeasonEnd}
                  onChange={(e) => setRegSeasonEnd(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  ISO-8601 in UTC. You can leave this empty and configure the
                  env var later.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Playoffs start (UTC, optional)
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="e.g. 2026-04-18T07:00:00Z"
                  value={playoffsStart}
                  onChange={(e) => setPlayoffsStart(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  ISO-8601 in UTC. You can leave this empty and configure the
                  env var later.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRollover}
                disabled={rolloverLoading || !!rolloverDisabledReason}
                className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 disabled:opacity-60 text-sm font-medium"
              >
                {rolloverLoading
                  ? "Running season rollover..."
                  : "End season & start new one"}
              </button>
              {rolloverDisabledReason && (
                <span className="text-xs text-slate-300 max-w-md">
                  {rolloverDisabledReason}
                </span>
              )}
            </div>

            {rolloverError && (
              <div className="rounded-md border border-red-500/60 bg-red-950/50 px-3 py-2 text-xs text-red-100">
                {rolloverError}
              </div>
            )}

            {rolloverResult && rolloverResult.ok && (
              <div className="space-y-3">
                <SuccessMessage>
                  <div className="font-semibold mb-0.5">
                    Season rollover completed successfully.
                  </div>
                  <div>
                    Closed season:{" "}
                    <span className="font-mono">
                      {rolloverResult.current_season?.code ??
                        CURRENT_SEASON_CODE ??
                        "unknown"}
                    </span>
                  </div>
                  <div>
                    New season:{" "}
                    <span className="font-mono">
                      {rolloverResult.new_season?.code ?? "unknown"}
                    </span>
                  </div>
                </SuccessMessage>

                {rolloverResult.steps && rolloverResult.steps.length > 0 && (
                  <div className="rounded-md border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs text-slate-100">
                    <div className="font-semibold mb-1">
                      Steps executed
                    </div>
                    <ul className="space-y-1">
                      {rolloverResult.steps.map((s, idx) => (
                        <li
                          key={idx}
                          className={
                            s.ok
                              ? "text-emerald-200"
                              : "text-amber-200"
                          }
                        >
                          {s.ok ? "✅" : "⚠️"}{" "}
                          {s.message || s.step || "Step"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {rolloverResult.env_next_actions && (
                  <div className="rounded-md border border-indigo-500/60 bg-indigo-950/40 px-3 py-2 text-xs text-indigo-100">
                    <div className="font-semibold mb-1">
                      Next step: update backend env vars
                    </div>
                    {rolloverResult.env_next_actions.message && (
                      <div className="mb-1">
                        {rolloverResult.env_next_actions.message}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <div className="text-[11px] text-slate-300">
                          CURRENT_SEASON_CODE
                        </div>
                        <div className="font-mono break-all">
                          {rolloverResult.env_next_actions
                            .CURRENT_SEASON_CODE ?? "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-300">
                          REGULAR_SEASON_END_UTC
                        </div>
                        <div className="font-mono break-all">
                          {rolloverResult.env_next_actions
                            .REGULAR_SEASON_END_UTC ?? "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-300">
                          PLAYOFFS_START_UTC
                        </div>
                        <div className="font-mono break-all">
                          {rolloverResult.env_next_actions
                            .PLAYOFFS_START_UTC ?? "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {rolloverResult && !rolloverResult.ok && (
              <div className="rounded-md border border-amber-500/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-100 space-y-1">
                <div className="font-semibold">
                  Rollover request completed but did not report success.
                </div>
                {rolloverResult.error && <div>{rolloverResult.error}</div>}
                {typeof rolloverResult.status === "number" && (
                  <div>Status: {rolloverResult.status}</div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Snapshot confirmation dialog */}
        <ConfirmDialog
          open={snapshotConfirmOpen}
          title="Create snapshot of current season?"
          description={
            <p>
              This will create a frozen snapshot of the{" "}
              <span className="font-semibold">global leaderboard</span> for the{" "}
              <span className="font-mono">
                {CURRENT_SEASON_CODE || "??-??"}
              </span>{" "}
              season. It does not delete any data.
            </p>
          }
          confirmLabel={snapshotLoading ? "Creating..." : "Yes, create snapshot"}
          onConfirm={async () => {
            setSnapshotConfirmOpen(false);
            await runSnapshot();
          }}
          onCancel={() => setSnapshotConfirmOpen(false)}
          confirmVariant="primary"
        />

        {/* Season rollover confirmation dialog */}
        <ConfirmDialog
          open={rolloverConfirmOpen}
          title="End current season and start a new one?"
          description={
            <div className="space-y-1">
              <p>
                This will{" "}
                <span className="font-semibold text-red-200">
                  snapshot the current global leaderboard, delete all matches
                  and scores for the current season, soft-delete its brackets,
                  and create a new season row
                </span>
                .
              </p>
              <p className="text-xs text-slate-300">
                You will still need to update backend env vars and redeploy
                afterward for the new season to become active.
              </p>
            </div>
          }
          confirmLabel={
            rolloverLoading
              ? "Running..."
              : "Yes, end season & start new one"
          }
          onConfirm={async () => {
            setRolloverConfirmOpen(false);
            await runRollover();
          }}
          onCancel={() => setRolloverConfirmOpen(false)}
          confirmVariant="danger"
        />
      </main>
	  <Footer />
    </div>
  );
};