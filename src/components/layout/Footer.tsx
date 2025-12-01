// src/components/layout/Footer.tsx
import React from "react";
import { Link } from "react-router-dom";

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-800 px-6 py-4 text-sm text-slate-400">
      <div className="flex flex-col items-center justify-center gap-2 text-center">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/dashboard"
            className="hover:text-slate-200 transition-colors"
          >
            Home
          </Link>

          <a
            href="mailto:admin@nbacorner.com"
            className="hover:text-slate-200 transition-colors"
          >
            Advertise
          </a>

          <Link
            to="/terms"
            className="hover:text-slate-200 transition-colors"
          >
            Terms &amp; Conditions
          </Link>

          <Link
            to="/faqs"
            className="hover:text-slate-200 transition-colors"
          >
            FAQs
          </Link>
        </div>

        <div className="text-xs text-slate-500">
          © {new Date().getFullYear()} NBA Corner. All rights reserved. Designed and developed by Pol Bosch
        </div>
      </div>
    </footer>
  );
};
