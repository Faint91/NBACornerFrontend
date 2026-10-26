const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const router = fs.readFileSync("src/main.tsx", "utf8");
// Discover menus only through page components imported by the mounted router.
const pages = [...router.matchAll(/import \{ (\w+) \} from "\.\/pages\/(\w+)"/g)]
  .map(([, name, file]) => ({ name, path: `src/pages/${file}.tsx` }))
  .filter(page => new RegExp(`<${page.name}\\s*/>`).test(router));

function menus(page) {
  const source = fs.readFileSync(page.path, "utf8");
  const ast = ts.createSourceFile(page.path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = [];
  function visit(node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "nav") found.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return found;
}
const activeMenus = pages.map(page => ({ ...page, menus: menus(page) })).filter(page => page.menus.length);

function render(source, user) {
  const events = [];
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  const output = ts.transpileModule(`export function render() { return (${source}); }`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const unexpectedApi = () => { throw Error("Navigation must not call an API or storage"); };
  vm.runInNewContext(output, {
    exports, user, token: user ? "fixture-token" : null,
    require: name => {
      assert.equal(name, "react/jsx-runtime");
      return { jsx, jsxs: jsx };
    },
    navigate: path => events.push(`navigate:${path}`),
    navigateProtected: path => events.push(`protected:${path}`),
    navigatePublicProtected: path => events.push(`protected:${path}`),
    setIsMobileMenuOpen: open => events.push(`menu:${open}`),
    logout: () => events.push("logout"),
    fetch: unexpectedApi, localStorage: { getItem: unexpectedApi, setItem: unexpectedApi },
  });
  return { tree: exports.render(), events };
}
function nodes(node) {
  return !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}
function text(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  return !node || typeof node !== "object" ? "" : [node.props?.children].flat(Infinity).map(text).join("").trim();
}

test("mounted pages contain all 11 primary navigation copies, each with desktop and mobile menus", () => {
  assert.deepEqual(activeMenus.map(p => p.name).sort(), [
    "AccountPage", "AdminPage", "BracketPage", "DashboardPage", "FaqsPage", "FindLeaguesPage",
    "LeaderboardPage", "LeagueInfoPage", "LeagueStatsPage", "PastSeasonsPage", "TermsPage",
  ]);
  for (const page of activeMenus) assert.equal(page.menus.length, 2, page.name);
});

for (const page of activeMenus) {
  for (const [index, menu] of page.menus.entries()) {
    const mobile = index === 1;
    test(`${page.name}: ${mobile ? "mobile" : "desktop"} Daily 1on1 is an ordinary same-tab link in the correct position`, () => {
      for (const user of [null, { username: "Fixture", is_admin: false }, { username: "Admin", is_admin: true }]) {
        const { tree, events } = render(menu, user);
        const actions = nodes(tree).filter(n => ["a", "button"].includes(n.type));
        const labels = actions.map(text);
        assert.equal(labels.filter(label => label === "Daily 1on1").length, 1);
        const pos = labels.indexOf("Daily 1on1");
        assert.deepEqual(labels.slice(0, pos + 1), [
          "Dashboard", "My Leagues", "Find a League", "Leaderboards", "Past Seasons", "Daily 1on1",
        ]);
        assert.ok(["Admin", "Account"].includes(labels[pos + 1]));
        const link = actions[pos];
        assert.equal(link.type, "a");
        assert.equal(link.props.href, "https://1on1ball.com");
        assert.equal(link.props.target, undefined);
        assert.equal(link.props.tabIndex, undefined);
        assert.match(link.props.className, /\bborder border-orange-500\b/);
        assert.match(link.props.className, /(?:^| )bg-orange-400(?: |$)/);
        assert.match(link.props.className, /text-slate-950/);
        assert.match(link.props.className, /hover:border-orange-600/);
        assert.match(link.props.className, /hover:bg-orange-500/);
        assert.match(link.props.className, /focus-visible:outline-2/);
        assert.match(link.props.className, /focus-visible:outline-orange-300/);
        assert.doesNotMatch(link.props.className, /gradient|badge|icon|animate-|transition/);
        assert.equal(text(link), "Daily 1on1");
        assert.deepEqual(events, []);
        if (mobile) {
          assert.match(link.props.className, /w-full min-w-0 min-h-11/);
          link.props.onClick();
          assert.deepEqual(events, ["menu:false"]);
        } else {
          assert.equal(link.props.onClick, undefined);
          assert.match(tree.props.className, /flex-wrap/);
        }
        for (const label of ["Dashboard", "My Leagues", "Find a League", "Leaderboards", "Past Seasons", "Account"]) assert.ok(labels.includes(label), label);
        assert.equal(labels.includes("Admin"), user?.is_admin === true);
        if (mobile) {
          const authLabel = labels.includes("Sign in") ? "Sign in" : "Logout";
          actions.find(n => text(n) === authLabel).props.onClick();
          if (user) assert.ok(events.includes("logout"));
        }
      }
    });
  }
}

test("dashboard starts with the original bracket controls and contains no promotional card", () => {
  assert.equal(fs.existsSync("src/components/DailyOneOnOneCard.tsx"), false);
  assert.equal(fs.existsSync("scripts/test-daily-one-on-one.cjs"), false);
  const dashboard = fs.readFileSync("src/pages/DashboardPage.tsx", "utf8");
  assert.doesNotMatch(dashboard, /DailyOneOnOneCard|daily-one-on-one-title|Play Daily 1on1|The Daily Matchup/);
  assert.match(dashboard, /<main className="flex-1 p-6 space-y-6">\s*\{\/\* Top controls \*\/\}/);
  for (const label of ["Playoff Brackets", "My bracket", "My leagues", "League brackets"]) assert.ok(dashboard.includes(label));
});

test("no internal Daily 1on1 route or API/auth dependency is introduced", () => {
  assert.doesNotMatch(router, /path=["']\/1on1/);
  for (const page of activeMenus) {
    for (const menu of page.menus) {
      const link = menu.match(/<a\s+href="https:\/\/1on1ball\.com"[\s\S]*?<\/a>/g);
      assert.equal(link?.length, 1);
      assert.doesNotMatch(link[0], /fetch|useApi|useAuth|auth_token|Authorization|navigateProtected|navigatePublicProtected|\?src|target=/);
    }
  }
});
