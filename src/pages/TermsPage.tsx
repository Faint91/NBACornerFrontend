// src/pages/TermsPage.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Footer } from "../components/layout/Footer";


export const TermsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col">
      {/* Header (same style as other pages) */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-6">
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
            {user?.is_admin && (
              <button
                onClick={() => navigate("/admin")}
                className="text-sm px-3 py-1 rounded-md border border-transparent hover:bg-slate-800"
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

      <main className="flex-1 p-6 space-y-6 max-w-4xl mx-auto text-slate-100">
        <header className="space-y-1">
          <h2 className="text-xl font-semibold">Terms &amp; Conditions</h2>
          <p className="text-xs text-slate-400">
            Last updated: November 27, 2025
          </p>
        </header>

        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <section className="space-y-2">
            <p>
              Welcome to <span className="font-semibold">NBA Corner</span>{" "}
              (&quot;NBA Corner&quot;, &quot;we&quot;, &quot;us&quot;, or
              &quot;our&quot;). These Terms &amp; Conditions
              (&quot;Terms&quot;) govern your access to and use of the NBA
              Corner website, applications, and related services (collectively,
              the &quot;Service&quot;).
            </p>
            <p>
              By creating an account, accessing, or using the Service, you agree
              to be bound by these Terms. If you do not agree, you must not use
              the Service.
            </p>
          </section>

          {/* 1. Eligibility */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">
              1. Eligibility
            </h3>
            <p>
              1.1. By using the Service, you represent and warrant that:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>You are legally capable of entering into a binding agreement; and</li>
              <li>Your use of the Service complies with all applicable laws and regulations.</li>
            </ul>
          </section>

          {/* 2. Accounts and Security */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">
              2. Accounts and Security
            </h3>
            <p>
              2.1. To access certain features (such as creating brackets or
              joining leagues), you must create an account and provide accurate,
              current, and complete information.
            </p>
            <p>
              2.2. You are responsible for maintaining the confidentiality of
              your login credentials and for all activity that occurs under your
              account.
            </p>
            <p>
              2.3. You must promptly notify us at{" "}
              <a
                href="mailto:admin@nbacorner.com"
                className="text-indigo-300 hover:text-indigo-200 underline"
              >
                admin@nbacorner.com
              </a>{" "}
              if you become aware of any unauthorized use of your account or
              any other security breach.
            </p>
            <p>
              2.4. We reserve the right to suspend or terminate your account at
              any time, with or without notice, if we reasonably believe that:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>You have violated these Terms;</li>
              <li>Your account has been compromised; or</li>
              <li>
                Your use of the Service may cause harm to us, other users, or
                third parties.
              </li>
            </ul>
          </section>

          {/* 3. The Service */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">
              3. The Service: Brackets, Leagues, and Leaderboards
            </h3>
            <p>
              3.1. NBA Corner allows users to create and manage NBA playoff
              prediction brackets, participate in public and private leagues,
              and view leaderboards and historical snapshots.
            </p>
            <p>
              3.2. Scoring, league rules, and any tiebreakers are determined by
              our internal scoring model and system logic. We may update these
              rules from time to time to correct errors, reflect rule changes in
              the NBA, or improve the user experience.
            </p>
            <p>
              3.3. Unless explicitly stated otherwise, the Service is intended{" "}
              <span className="font-semibold">for entertainment purposes only</span>. Any
              standings, rankings, or points have no inherent monetary value.
            </p>
            <p>
              3.4. We may, at our discretion, run promotional contests or award
              prizes. Any such promotions will be subject to separate or
              additional rules. In case of conflict between those rules and
              these Terms, the promotion-specific rules will apply to that
              promotion.
            </p>
          </section>

          {/* 4. No Gambling */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">
              4. No Gambling or Wagering
            </h3>
            <p>
              4.1. NBA Corner is{" "}
              <span className="font-semibold">not a gambling platform</span>. The
              Service does not support or facilitate real-money wagering or
              betting.
            </p>
            <p>
              4.2. You agree not to use the Service:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                To conduct or promote any form of illegal gambling, betting, or
                wagering; or
              </li>
              <li>
                In combination with any third-party scheme that uses NBA Corner
                results for unauthorized gambling or betting.
              </li>
            </ul>
            <p>
              4.3. You are solely responsible for ensuring that your use of the
              Service complies with the laws of your jurisdiction, including any
              laws related to contests, competitions, and gaming.
            </p>
          </section>

          {/* 5. User Content */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">
              5. User Content
            </h3>
            <p>
              5.1. &quot;User Content&quot; means any content that you submit,
              upload, or otherwise provide through the Service, including but
              not limited to league names and descriptions, usernames, messages
              or comments (if enabled), and any other data or material you
              provide.
            </p>
            <p>
              5.2. You retain ownership of your User Content, but you grant NBA
              Corner a worldwide, non-exclusive, royalty-free, sublicensable and
              transferable license to use, reproduce, display, modify, and
              distribute your User Content as reasonably necessary to operate,
              improve, and promote the Service.
            </p>
            <p>
              5.3. You represent and warrant that you have all rights necessary
              to submit the User Content and that your User Content does not
              infringe or violate any third-party rights or any applicable law.
            </p>
            <p>
              5.4. We reserve the right, but are not obligated, to review,
              remove, or modify User Content that we believe violates these
              Terms or may harm other users, us, or third parties.
            </p>
          </section>

          {/* 6. Prohibited Conduct */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">
              6. Prohibited Conduct
            </h3>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Violate any applicable law or regulation;</li>
              <li>
                Harass, abuse, or harm another person or group, or promote hate,
                discrimination, or violence;
              </li>
              <li>
                Impersonate any person or entity, or misrepresent your
                affiliation with a person or entity;
              </li>
              <li>
                Attempt to gain unauthorized access to any part of the Service,
                other user accounts, or our systems or networks;
              </li>
              <li>
                Interfere with or disrupt the Service, including by introducing
                malicious code or attempting to bypass security measures; or
              </li>
              <li>
                Scrape, harvest, or collect data from the Service, except as
                permitted by us in writing.
              </li>
            </ul>
          </section>

          {/* 7. Intellectual Property */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">
              7. Intellectual Property
            </h3>
            <p>
              7.1. The Service, including all software, code, design, logos,
              text, graphics, and other content (collectively, &quot;NBA Corner
              Content&quot;), is owned by or licensed to NBA Corner and is
              protected by intellectual property laws.
            </p>
            <p>
              7.2. Except as expressly permitted by these Terms, you may not
              copy, modify, distribute, sell, or lease any part of the NBA
              Corner Content, or use any trademarks or branding associated with
              NBA Corner without our prior written consent.
            </p>
            <p>
              7.3. NBA Corner grants you a limited, non-exclusive,
              non-transferable, revocable license to access and use the Service
              for your personal, non-commercial use, subject to these Terms.
            </p>
          </section>

          {/* 8. No Affiliation */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">
              8. No Affiliation with the NBA
            </h3>
            <p>
              8.1. NBA Corner is an independent project and is{" "}
              <span className="font-semibold">
                not affiliated with, endorsed by, or sponsored by
              </span>{" "}
              the National Basketball Association (NBA), any NBA team, or any
              related entity, league, or players association.
            </p>
            <p>
              8.2. Any team names, logos, or marks are the property of their
              respective owners and are used on the Service for descriptive and
              informative purposes only.
            </p>
          </section>

          {/* 9. Third-Party Services */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">
              9. Third-Party Services
            </h3>
            <p>
              9.1. The Service may integrate with or link to third-party
              services, websites, or tools. We do not control and are not
              responsible for the content, policies, or practices of
              third-party services.
            </p>
            <p>
              9.2. Your use of third-party services is governed by their own
              terms and privacy policies, not these Terms.
            </p>
          </section>

          {/* 10. Changes to the Service */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">
              10. Changes to the Service
            </h3>
            <p>
              10.1. We may modify, suspend, or discontinue any part of the
              Service at any time, with or without notice.
            </p>
            <p>
              10.2. We are not liable to you or any third party for any
              modification, suspension, or discontinuation of the Service.
            </p>
          </section>

          {/* 11. Disclaimers */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">
              11. Disclaimers
            </h3>
            <p>
              11.1. The Service is provided &quot;as is&quot; and &quot;as
              available&quot;. To the maximum extent permitted by law, we
              disclaim all warranties, express or implied, including implied
              warranties of merchantability, fitness for a particular purpose,
              and non-infringement.
            </p>
            <p>
              11.2. We do not warrant that the Service will be uninterrupted,
              secure, or error-free, that defects will be corrected, or that any
              information provided on or through the Service is accurate,
              complete, or current at all times.
            </p>
            <p>You use the Service at your own risk.</p>
          </section>

          {/* 12. Limitation of Liability */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">
              12. Limitation of Liability
            </h3>
            <p>
              12.1. To the maximum extent permitted by law, in no event will NBA
              Corner or its owners, operators, or affiliates be liable for any
              indirect, incidental, special, consequential, or punitive damages,
              or any loss of profits or revenues, whether incurred directly or
              indirectly, or any loss of data, goodwill, or other intangible
              losses, resulting from your use of or inability to use the
              Service.
            </p>
            <p>
              12.2. To the maximum extent permitted by law, our total liability
              for any claim arising out of or relating to the Service or these
              Terms is limited to the greater of (a) the amount you have paid to
              us (if any) in the 12 months preceding the event giving rise to
              the claim, or (b) 50 CAD.
            </p>
          </section>

          {/* 13. Indemnification */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">
              13. Indemnification
            </h3>
            <p>
              13.1. You agree to indemnify, defend, and hold harmless NBA Corner
              and its owners, operators, and affiliates from and against any
              claims, liabilities, damages, losses, and expenses (including
              reasonable legal fees) arising out of or in any way connected with
              your use of the Service, your violation of these Terms, or your
              violation of any rights of another person or entity.
            </p>
          </section>

          {/* 14. Changes to These Terms */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">
              14. Changes to These Terms
            </h3>
            <p>
              14.1. We may update these Terms from time to time. When we do, we
              will update the &quot;Last updated&quot; date at the top of this
              page. Your continued use of the Service after the updated Terms
              have been posted constitutes your acceptance of the changes.
            </p>
          </section>

          {/* 15. Governing Law */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">
              15. Governing Law and Dispute Resolution
            </h3>
            <p>
              15.1. These Terms and your use of the Service are governed by the
              laws of the Province of British Columbia, Canada, without regard
              to its conflict of laws principles.
            </p>
            <p>
              15.2. You agree that any dispute arising out of or relating to
              these Terms or the Service will be subject to the exclusive
              jurisdiction of the courts located in British Columbia, Canada.
            </p>
          </section>

          {/* 16. Termination */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">
              16. Termination
            </h3>
            <p>
              16.1. We may suspend or terminate your access to the Service at
              any time, with or without notice, if we reasonably believe that
              you have violated these Terms or your use may cause harm.
            </p>
            <p>
              16.2. Upon termination, your right to use the Service will
              immediately cease. Provisions that by their nature should survive
              termination (including ownership, disclaimers, limitations of
              liability, and indemnification) will continue to apply.
            </p>
          </section>

          {/* 17. Contact */}
          <section className="space-y-2">
            <h3 className="text-base font-semibold text-slate-100">
              17. Contact Us
            </h3>
            <p>
              If you have any questions about these Terms, you can contact us
              at:
            </p>
            <p>
              Email:{" "}
              <a
                href="mailto:admin@nbacorner.com"
                className="text-indigo-300 hover:text-indigo-200 underline"
              >
                admin@nbacorner.com
              </a>
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
};
