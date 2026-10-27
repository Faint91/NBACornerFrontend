const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { headerHarness, nodes, text, pageHeader } = require("./helpers/header-harness.cjs");

const pages = ["AccountPage", "AdminPage", "BracketPage", "DashboardPage", "FaqsPage", "FindLeaguesPage", "LeaderboardPage", "LeagueInfoPage", "LeagueStatsPage", "PastSeasonsPage", "TermsPage"];
const guardedPages = ["BracketPage", "FaqsPage", "LeaderboardPage", "PastSeasonsPage", "TermsPage"];
const redirectPages = ["LeaderboardPage", "PastSeasonsPage"];
const publicPages = [...guardedPages];
const productLabels = ["Dashboard", "My Leagues", "Find a League", "Leaderboards", "Past Seasons", "Daily 1on1"];
const router = fs.readFileSync("src/main.tsx", "utf8");
const sharedSource = fs.readFileSync("src/components/layout/Header.tsx", "utf8");
const button = (tree, label, last = false) => {
  const matches = nodes(tree).filter(n => n.type === "button" && text(n) === label);
  assert.ok(matches.length, `Missing ${label}`);
  return last ? matches.at(-1) : matches[0];
};

test("all 11 mounted navigation pages use one Header and cannot reintroduce local primary menus", () => {
  const mounted = [...router.matchAll(/import \{ (\w+) \} from "\.\/pages\/(\w+)"/g)]
    .filter(([, name]) => new RegExp(`<${name}\\s*/>`).test(router))
    .map(([, , file]) => file);
  const migrated = mounted.filter(name => fs.readFileSync(`src/pages/${name}.tsx`, "utf8").includes("<Header"));
  assert.deepEqual(migrated.sort(), [...pages].sort());
  for (const name of pages) {
    const source = fs.readFileSync(`src/pages/${name}.tsx`, "utf8");
    assert.ok(pageHeader(name));
    assert.doesNotMatch(source, /<nav\b|isMobileMenuOpen|https:\/\/1on1ball\.com|Top navigation|Top controls.*Daily 1on1/s);
    assert.equal((source.match(/from "\.\.\/components\/layout\/Header"/g) || []).length, 1);
  }
  for (const label of productLabels) assert.equal((sharedSource.match(new RegExp(`label: "${label}"`, "g")) || []).length, 1, label);
  assert.equal((sharedSource.match(/primaryNavigation\.map/g) || []).length, 2);
  assert.equal((sharedSource.match(/bg-orange-400/g) || []).length, 1);
  assert.equal((sharedSource.match(/<nav\b/g) || []).length, 2);
  assert.doesNotMatch(fs.readFileSync("src/App.tsx", "utf8"), /layout\/Header/);
});

for (const page of pages) for (const mobile of [false, true]) {
  test(`${page}: shared ${mobile ? "mobile" : "desktop"} menu preserves items, styling, visibility and session behavior`, () => {
    for (const user of [null, { username: "Fixture", is_admin: false }, { username: "Admin", is_admin: true }]) {
      const h = headerHarness({ page, user });
      let tree = h.render();
      if (mobile) { button(tree, "Menu").props.onClick(); tree = h.render(); }
      const menus = nodes(tree).filter(n => n.type === "nav");
      assert.equal(menus.length, mobile ? 2 : 1);
      const menu = menus[mobile ? 1 : 0];
      const actions = nodes(menu).filter(n => ["a", "button"].includes(n.type));
      const labels = actions.map(text);
      assert.deepEqual(labels.slice(0, 6), productLabels);
      assert.equal(labels.filter(label => label === "Daily 1on1").length, 1);
      assert.equal(labels.includes("Admin"), user?.is_admin === true);
      assert.equal(labels[6], user?.is_admin ? "Admin" : "Account");
      const link = actions[5];
      assert.equal(link.type, "a");
      assert.equal(link.props.href, "https://1on1ball.com");
      assert.equal(link.props.target, undefined);
      assert.match(link.props.className, /(?:^| )bg-orange-400(?: |$)/);
      assert.match(link.props.className, /text-slate-950/);
      assert.match(link.props.className, /border-orange-500/);
      assert.match(link.props.className, /hover:bg-orange-500/);
      assert.match(link.props.className, /focus-visible:outline-2/);
      assert.match(link.props.className, /focus-visible:outline-orange-300/);
      assert.equal(text(link), "Daily 1on1");
      assert.deepEqual(h.events, []);
      if (mobile) {
        assert.match(link.props.className, /w-full min-w-0 min-h-11/);
        assert.ok(nodes(menu).some(n => n.props?.className === "mt-3 border-t border-slate-800 pt-2"));
        link.props.onClick();
        assert.equal(h.isOpen(), false);
      } else {
        assert.equal(link.props.onClick, undefined);
        assert.match(menu.props.className, /hidden md:flex flex-wrap/);
      }
      const sessionLabel = user || !publicPages.includes(page) ? "Logout" : "Sign in";
      button(tree, sessionLabel, mobile).props.onClick();
      const expected = [];
      if (user || !publicPages.includes(page)) expected.push("logout");
      if ((!user && publicPages.includes(page)) || redirectPages.includes(page)) expected.push("navigate:/login");
      assert.deepEqual(h.events, expected);
    }
  });
}

for (const page of pages) {
  test(`${page}: protected destinations, logo and Admin preserve their existing navigation policy`, () => {
    for (const mobile of [false, true]) for (const historical of page === "BracketPage" ? [false, true] : [true]) {
      const h = headerHarness({ page, historical });
      let tree = h.render();
      if (mobile) { button(tree, "Menu").props.onClick(); tree = h.render(); }
      const guarded = guardedPages.includes(page) && (page !== "BracketPage" || historical);
      const cases = [["Dashboard", "/dashboard"], ["My Leagues", "/leagues/info"], ["Find a League", "/leagues/find"], ["Account", "/account"], ["Leaderboards", "/leaderboard"], ["Past Seasons", "/past-seasons"]];
      if (!mobile) cases.push(["NBA Corner", "/dashboard"]);
      for (const [label, path] of cases) {
        button(tree, label, mobile).props.onClick();
        const protectedDestination = !["Leaderboards", "Past Seasons"].includes(label);
        assert.equal(h.events.at(-1), `${guarded && protectedDestination ? "prompt" : "navigate"}:${path}`);
        if (mobile) assert.equal(h.isOpen(), false);
      }
      // Auth restoration can expose an existing admin user before a token is ready.
      const admin = headerHarness({ page, user: { username: "Admin", is_admin: true }, token: null, historical });
      button(admin.render(), "Admin").props.onClick();
      assert.equal(admin.events.at(-1), `${page === "LeaderboardPage" ? "prompt" : "navigate"}:/admin`);
    }
  });
}

test("mobile menu starts closed, toggles both ways and closes on session actions", () => {
  const h = headerHarness({ page: "DashboardPage", user: { username: "Fixture" } });
  assert.equal(h.isOpen(), false);
  button(h.render(), "Menu").props.onClick(); assert.equal(h.isOpen(), true);
  button(h.render(), "Menu").props.onClick(); assert.equal(h.isOpen(), false);
  button(h.render(), "Menu").props.onClick();
  button(h.render(), "Logout", true).props.onClick();
  assert.equal(h.isOpen(), false); assert.deepEqual(h.events, ["logout"]);
});

test("no dashboard promotion, internal 1on1 route, or header API/storage dependency exists", () => {
  assert.equal(fs.existsSync("src/components/DailyOneOnOneCard.tsx"), false);
  assert.doesNotMatch(router, /path=["']\/1on1/);
  const dashboard = fs.readFileSync("src/pages/DashboardPage.tsx", "utf8");
  assert.doesNotMatch(dashboard, /DailyOneOnOneCard|daily-one-on-one-title|Play Daily 1on1|The Daily Matchup/);
  assert.match(dashboard, /<main className="flex-1 p-6 space-y-6">\s*\{\/\* Top controls \*\/\}/);
  assert.doesNotMatch(sharedSource, /fetch\s*\(|useApi|localStorage|sessionStorage|auth_token|Authorization|target="_blank"/);
});
