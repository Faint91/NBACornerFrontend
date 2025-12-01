import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { BracketPage } from "./pages/BracketPage";
import { RegisterPage } from "./pages/RegisterPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { PastSeasonsPage } from "./pages/PastSeasonsPage";
import { FindLeaguesPage } from "./pages/FindLeaguesPage";
import { LeagueInfoPage } from "./pages/LeagueInfoPage";
import { AdminPage } from "./pages/AdminPage";
import { TermsPage } from "./pages/TermsPage";
import { FaqsPage } from "./pages/FaqsPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { AccountPage } from "./pages/AccountPage";
import { LeagueStatsPage } from "./pages/LeagueStatsPage";

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const RootApp: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* default route */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
		  <Route path="/register" element={<RegisterPage />} />
		  <Route path="/reset-password" element={<ResetPasswordPage />} />
		  <Route path="/leaderboard" element={<LeaderboardPage />} />
		  <Route path="/past-seasons" element={<PastSeasonsPage />} />
		  <Route path="/terms" element={<TermsPage />} />
          <Route path="/faqs" element={<FaqsPage />} />
		  <Route
            path="/league-stats"
            element={
              <ProtectedRoute>
                <LeagueStatsPage />
              </ProtectedRoute>
            }
          />
		  <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
		  <Route
		      path="/bracket/:bracketId"
		      element={
		    	<ProtectedRoute>
		    	  <BracketPage />
		    	</ProtectedRoute>
		      }
		    />
		  <Route
		      path="/leagues/find"
		      element={
		    	<ProtectedRoute>
		    	  <FindLeaguesPage />
		    	</ProtectedRoute>
		      }
		    />
          <Route
              path="/leagues/info"
              element={
                <ProtectedRoute>
                  <LeagueInfoPage />
                </ProtectedRoute>
              }
            />
		  <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);
