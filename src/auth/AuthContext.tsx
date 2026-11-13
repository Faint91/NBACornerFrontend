import { createContext, useContext, useState, useEffect, useRef } from "react";
import { setUserId, trackEvent } from "../lib/analytics";
import type { ReactNode } from "react";

type User = {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  created_at?: string | null;
};

type AuthState = {
  user: User | null;
  token: string | null;
  authReady: boolean;
  login: (args: { token: string; user: User }) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const restoration = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    restoration.current = controller;

    async function restoreSession() {
      try {
        const storedToken = localStorage.getItem("auth_token");
        const storedUser = localStorage.getItem("auth_user");
        if (!storedToken || !storedUser) return;

        const profile: User | null = JSON.parse(storedUser);
        if (!profile || typeof profile.id !== "string") return;

        const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/test-me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
        });
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_user");
          return;
        }
        if (!response.ok) return;

        const { user: verified } = await response.json();
        if (controller.signal.aborted || verified?.user_id !== profile.id ||
            typeof verified.username !== "string" || typeof verified.is_admin !== "boolean") return;

        setUser({ ...profile, username: verified.username, is_admin: verified.is_admin });
        setToken(storedToken);
      } catch {
        // A malformed session or unavailable verification leaves protected routes closed.
      } finally {
        if (!controller.signal.aborted) setAuthReady(true);
      }
    }

    void restoreSession();
    return () => controller.abort();
  }, []);

  const login = ({ token, user }: { token: string; user: User }) => {
    restoration.current?.abort();
    setAuthReady(true);
    setToken(token);
    setUser(user);
    localStorage.setItem("auth_token", token);
    localStorage.setItem("auth_user", JSON.stringify(user));
	setUserId(user.id);
    trackEvent("login", { method: "password" });
  };

  const logout = () => {
    restoration.current?.abort();
    setAuthReady(true);
    setToken(null);
    setUser(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
	trackEvent("logout");   // optional (GA4 doesn't have a standard "logout" event)
    setUserId(null);        // ✅ clears user_id for future events
  };

  return (
    <AuthContext.Provider value={{ user, token, authReady, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthState => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
