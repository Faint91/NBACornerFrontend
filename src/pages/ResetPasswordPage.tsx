// src/pages/ResetPasswordPage.tsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useApi } from "../api/client";

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const api = useApi();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMessage("Please enter your email address.");
      setSuccessMessage(null);
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      // Assumes backend has POST /auth/request-password-reset
      await api.post("/auth/forgot-password", { email: trimmed });

      // Generic message so we don't reveal whether the email exists or not
      setSuccessMessage(
        "If an account exists with that email, we've sent instructions to reset your password."
      );
    } catch (err: any) {
      setErrorMessage(
        err?.message || "Something went wrong. Please try again."
      );
      setSuccessMessage(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl">
        <div className="mb-4 text-center">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="text-xl font-semibold tracking-tight hover:text-slate-50"
          >
            NBA Corner
          </button>
        </div>

        <h1 className="text-lg font-semibold mb-1 text-center">
          Reset your password
        </h1>
        <p className="text-xs text-slate-400 mb-4 text-center">
          Enter the email you used to create your account and we&apos;ll send
          you a link to reset your password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="reset-email"
              className="block text-xs text-slate-300 mb-1"
            >
              Email address
            </label>
            <input
              id="reset-email"
              type="email"
              name="email"
              autoComplete="email"
              className="w-full text-sm px-3 py-2 rounded-md bg-slate-950 border border-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {errorMessage && (
            <p className="text-xs text-red-400">{errorMessage}</p>
          )}
          {successMessage && (
            <p className="text-xs text-emerald-400">{successMessage}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full text-sm px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Sending reset link..." : "Send reset link"}
          </button>
        </form>

        <div className="mt-4 text-xs text-slate-400 text-center">
          Remembered your password?{" "}
          <Link
            to="/login"
            className="text-indigo-300 hover:text-indigo-200"
          >
            Go back to login
          </Link>
        </div>
      </div>
    </div>
  );
};
