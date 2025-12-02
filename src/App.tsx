// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";

function App() {
  return (
    <div
      className="min-h-screen text-slate-50 flex flex-col bg-cover bg-center bg-fixed overflow-x-hidden"
      style={{
        backgroundImage:
          "linear-gradient(rgba(15,23,42,0.80), rgba(15,23,42,0.80)), url('/background.png')",
      }}
    >
      <div className="w-full max-w-2xl mx-auto px-4 py-8">
        <header className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            NBA Corner
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-300">
            Playoff bracket predictions, powered by your custom backend.
          </p>
        </header>

        <main className="rounded-xl border border-slate-700 bg-slate-800/60 p-6 shadow-lg">
          <Routes>
            {/* Redirect root to /login for now */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<LoginPage />} />

            {/* We will add /register, /bracket, /public-brackets, etc. here later */}
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
