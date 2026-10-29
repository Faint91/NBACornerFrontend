import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

type NavigateTo = (path: string) => void;
type NavigationItem = {
  label: string;
  destination: string;
  protected?: boolean;
  external?: boolean;
};

// Product destinations, ordering, and access intent have one canonical definition.
const primaryNavigation: readonly NavigationItem[] = [
  { label: "Dashboard", destination: "/dashboard", protected: true },
  { label: "My Leagues", destination: "/leagues/info", protected: true },
  { label: "Find a League", destination: "/leagues/find", protected: true },
  { label: "Leaderboards", destination: "/leaderboard" },
  { label: "Past Seasons", destination: "/past-seasons" },
  { label: "Daily 1on1", destination: "/1on1", external: true },
];
const adminItem: NavigationItem = { label: "Admin", destination: "/admin" };
const accountItem: NavigationItem = { label: "Account", destination: "/account", protected: true };
const dailyStyle = "border border-orange-500 bg-orange-400 text-slate-950 hover:border-orange-600 hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300";
const desktopItemStyle = "text-sm px-3 py-1 rounded-md border border-transparent hover:bg-slate-800";
const mobileItemStyle = "w-full text-left text-sm px-3 py-2 rounded-md hover:bg-slate-800";

type HeaderProps = {
  onProtectedNavigate?: NavigateTo;
  onAdminNavigate?: NavigateTo;
  // Preserve the existing public pages' distinct post-logout behavior.
  sessionBehavior?: "logout" | "sign-in-or-logout" | "logout-and-redirect";
};

export function Header({
  onProtectedNavigate,
  onAdminNavigate,
  sessionBehavior = "logout",
}: HeaderProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const protectedNavigate = onProtectedNavigate ?? navigate;
  const sessionLabel = sessionBehavior === "logout" || user ? "Logout" : "Sign in";

  function activateSession(mobile: boolean) {
    if (mobile) setIsMobileMenuOpen(false);
    if (sessionBehavior === "logout") {
      logout();
    } else {
      if (user) logout();
      if (!user || sessionBehavior === "logout-and-redirect") navigate("/login");
    }
  }

  function renderItem(item: NavigationItem, mobile: boolean, go?: NavigateTo) {
    if (item.external) {
      return (
        <a
          key={item.label}
          href={item.destination}
          onClick={mobile ? () => setIsMobileMenuOpen(false) : undefined}
          className={`${mobile ? "w-full min-w-0 min-h-11 flex items-center text-left text-sm px-3 py-2 rounded-md" : "text-sm px-3 py-1 rounded-md"} ${dailyStyle}`}
        >
          {item.label}
        </a>
      );
    }
    const navigateTo = go ?? (item.protected ? protectedNavigate : navigate);
    return (
      <button
        key={item.label}
        onClick={() => {
          navigateTo(item.destination);
          if (mobile) setIsMobileMenuOpen(false);
        }}
        className={mobile ? mobileItemStyle : desktopItemStyle}
      >
        {item.label}
      </button>
    );
  }

  return (
    <header className="border-b border-slate-800">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <button
            onClick={() => protectedNavigate(primaryNavigation[0].destination)}
            className="text-xl font-semibold tracking-tight hover:text-slate-100"
          >
            NBA Corner
          </button>
          <nav className="hidden md:flex flex-wrap items-center gap-2">
            {primaryNavigation.map(item => renderItem(item, false))}
            {user?.is_admin && renderItem(adminItem, false, onAdminNavigate ?? navigate)}
            {renderItem(accountItem, false)}
          </nav>
        </div>
        <div className="hidden md:flex items-center gap-3">
          {user && (
            <span className="text-sm text-slate-300">
              Logged in as <span className="font-semibold">{user.username}</span>
            </span>
          )}
          <button
            onClick={() => activateSession(false)}
            className="text-sm px-3 py-1 rounded-md border border-slate-600 hover:bg-slate-800"
          >
            {sessionLabel}
          </button>
        </div>
        <button
          type="button"
          className="inline-flex items-center rounded-md border border-slate-600 px-3 py-1 text-sm text-slate-100 hover:bg-slate-800 md:hidden"
          onClick={() => setIsMobileMenuOpen(prev => !prev)}
        >
          <span className="mr-1">Menu</span>
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            {isMobileMenuOpen ? (
              <path fill="currentColor" d="M6.225 4.811 4.81 6.225 10.586 12l-5.775 5.775 1.414 1.414L12 13.414l5.775 5.775 1.414-1.414L13.414 12l5.775-5.775-1.414-1.414L12 10.586 6.225 4.81z" />
            ) : (
              <path fill="currentColor" d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
            )}
          </svg>
        </button>
      </div>
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950/95">
          <nav className="flex flex-col gap-1 px-6 py-3">
            {primaryNavigation.map(item => renderItem(item, true))}
            {user?.is_admin && renderItem(adminItem, true, onAdminNavigate ?? navigate)}
            <div className="mt-3 border-t border-slate-800 pt-2">
              {user && (
                <div className="mb-1 text-xs text-slate-300">
                  Logged in as{" "}
                  <span className="font-semibold">{user.username}</span>
                </div>
              )}
              {renderItem(accountItem, true)}
              <button
                onClick={() => activateSession(true)}
                className="w-full text-left text-sm px-3 py-2 rounded-md border border-slate-600 hover:bg-slate-800"
              >
                {sessionLabel}
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
