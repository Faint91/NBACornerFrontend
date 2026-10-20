import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { NavigateOptions } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function useProtectedNavigation() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);

  function navigateProtected(
    to: string,
    options?: NavigateOptions,
    explanation = "You need to sign in or create an account to view this page.",
  ) {
    if (token) {
      setMessage(null);
      navigate(to, options);
    } else {
      setMessage(explanation);
    }
  }

  const dismiss = () => setMessage(null);
  const chooseAuth = (to: "/login" | "/register") => {
    dismiss();
    navigate(to);
  };

  return {
    navigateProtected,
    prompt: {
      open: message !== null,
      message: message ?? "",
      onDismiss: dismiss,
      onSignIn: () => chooseAuth("/login"),
      onCreateAccount: () => chooseAuth("/register"),
    },
  };
}
