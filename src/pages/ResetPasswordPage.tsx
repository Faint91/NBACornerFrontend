import React, { useState } from "react";
import { Link } from "react-router-dom";
import { apiPost } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { validateAccountPassword } from "../auth/identityPolicy";
import { resetLink, clearResetLink } from "../auth/resetLink";

export const ResetPasswordPage: React.FC = () => {
  const { logout } = useAuth();
  const [link] = useState(resetLink);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completing = Boolean(link?.present);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (completing) {
      if (!link || !/^[A-Za-z0-9_-]{43}$/.test(link.token)) {
        setError("Invalid or expired reset link"); return;
      }
      try { validateAccountPassword(password); }
      catch { setError("Password must contain 8 to 128 characters"); return; }
      if (password !== confirmation) { setError("Passwords do not match"); return; }
    } else if (!email.trim()) { setError("Enter your email address"); return; }
    setSubmitting(true);
    try {
      await apiPost(completing ? "/auth/reset-password" : "/auth/forgot-password",
        completing ? { token: link?.token, new_password: password } : { email: email.trim() });
      if (completing) { clearResetLink(); logout(); setPassword(""); setConfirmation(""); }
      setSuccess(true);
    } catch {
      setError(completing ? "Invalid or expired reset link, or reset temporarily unavailable. Open the latest email link and try again." : "Reset request unavailable. Please try again later.");
    } finally { setSubmitting(false); }
  }

  const inputClass = "w-full text-sm px-3 py-2 rounded-md bg-slate-950 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500";
  return (
    <div className="min-h-screen text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl">
        <h1 className="text-lg font-semibold mb-4 text-center">Reset your password</h1>
        {success ? <p role="status" className="text-emerald-400">{completing ? "Password reset successfully. Log in with your new password." : "If an account matches, reset instructions will be sent."}</p> : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {completing ? <>
              <p className="text-xs text-slate-400">Use 8–128 characters. Spaces count. If you refresh this page, reopen the original email link.</p>
              <label className="block" htmlFor="new-password">New password</label>
              <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} required />
              <label className="block" htmlFor="confirm-password">Confirm new password</label>
              <input id="confirm-password" type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} className={inputClass} required />
            </> : <>
              <p className="text-xs text-slate-400">Enter your account email to request a reset link.</p>
              <label className="block" htmlFor="reset-email">Email address</label>
              <input id="reset-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} required />
            </>}
            {error && <p role="alert" className="text-red-400">{error}</p>}
            <button type="submit" disabled={submitting} className="w-full px-3 py-2 rounded-md bg-indigo-600 disabled:opacity-60">{submitting ? "Please wait…" : completing ? "Set new password" : "Send reset link"}</button>
          </form>
        )}
        <Link to="/login" className="block mt-4 text-indigo-300">Go to login</Link>
      </div>
    </div>
  );
};
