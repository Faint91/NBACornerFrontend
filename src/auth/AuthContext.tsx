import { createContext, useContext, useState, useEffect } from "react";
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
  login: (args: { token: string; user: User }) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // restore from localStorage (optional but handy)
  useEffect(() => {
    const storedToken = localStorage.getItem("auth_token");
    const storedUser = localStorage.getItem("auth_user");
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        // ignore bad JSON
      }
    }
  }, []);

  const login = ({ token, user }: { token: string; user: User }) => {
    setToken(token);
    setUser(user);
    localStorage.setItem("auth_token", token);
    localStorage.setItem("auth_user", JSON.stringify(user));
	setUserId(user.id);
    trackEvent("login", { method: "password" });
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
	trackEvent("logout");   // optional (GA4 doesn't have a standard "logout" event)
    setUserId(null);        // ✅ clears user_id for future events
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
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
