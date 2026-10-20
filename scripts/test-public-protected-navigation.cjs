const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

// Execute the real components/hooks and API client with synthetic, offline I/O.
function load(file, requireHook, extra = {}) {
  const source = fs.readFileSync(file, "utf8").replaceAll("import.meta.env.VITE_API_URL", '"https://fixture.invalid"');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: requireHook, Error, console: { error() {} }, ...extra });
  return exports;
}
function hooks() {
  const slots = [];
  let index = 0, pending = [], dirty = true, tree;
  const react = {
    useState(initial) {
      const i = index++;
      if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], next => {
        const value = typeof next === "function" ? next(slots[i]) : next;
        if (!Object.is(value, slots[i])) { slots[i] = value; dirty = true; }
      }];
    },
    useRef(initial) { const i = index++; return slots[i] ??= { current: initial }; },
    useEffect(effect, deps) {
      const i = index++, old = slots[i];
      if (!old || !deps || deps.some((v, n) => !Object.is(v, old.deps[n]))) {
        pending.push(() => { old?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; });
      }
    },
    createContext: () => ({ Provider: "provider" }),
  };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  return { react, jsx, render(component) {
    index = 0; dirty = false; tree = component();
    const effects = pending; pending = []; effects.forEach(effect => effect());
    return tree;
  }, get tree() { return tree; }, get dirty() { return dirty; } };
}
function nodes(node) {
  return !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}
function visible(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  return !node || typeof node !== "object" ? "" : [node.props?.children].flat(Infinity).map(visible).join(" ");
}

// Render the real public pages/helper with offline data. Layout drawing is outside
// this navigation harness; no real router, network, storage, or auth writes run.
function surface(name, authenticated = false, historical = true) {
  const h = hooks(), calls = [], navigations = [], events = [];
  let auth = { authReady: true, token: authenticated ? "synthetic" : null,
    user: authenticated ? { id: "viewer", username: "Fixture", is_admin: false } : null,
    logout: () => events.push("logout") };
  h.react.useMemo = fn => fn();
  h.react.useLayoutEffect = () => {};
  h.react.useSyncExternalStore = (_subscribe, snapshot) => snapshot();
  const get = async path => {
    calls.push(path);
    if (path === "/season") return { season_code: "2026-27", bracket_creation_opens_at: "2027-04-01T00:00:00Z", playoff_lock_at: "2027-04-15T00:00:00Z", standings_freeze_reached: false, playoffs_locked: false, bracket_creation_open: false };
    if (path === "/leaderboard/history") return { seasons: [{ season_id: "past", season_code: "2025-26" }, { season_id: "older", season_code: "2024-25" }] };
    if (path.startsWith("/leaderboard/history/")) return { columns: [], rows: [], snapshot_at: null };
    if (path === "/history/bracket/fixture" || (authenticated && path === "/bracket/fixture")) return { bracket: { id: "fixture", name: "Historical fixture", is_owner: false, is_done: true, read_only: true, owner: { username: "Other viewer" } }, matches: {} };
    if (authenticated && path === "/brackets/me") return { playoffs_locked: false, playoffs_deadline_utc: null };
    if (authenticated && path === "/leagues/me") return { leagues: [] };
    if (path === "/leaderboard") return { rows: [], master_matchups: {} };
    throw Error("Unexpected protected read: " + path);
  };
  const authModule = { useAuth: () => auth };
  const router = { useNavigate: () => (...args) => { navigations.push(args); events.push("navigate:" + args[0]); },
    useLocation: () => ({ pathname: historical ? "/history/bracket/fixture" : "/bracket/fixture", state: null }),
    useParams: () => ({ bracketId: "fixture" }), Link: "link" };
  const moduleCache = {};
  function resolver(dep) {
    if (dep === "react") return h.react;
    if (dep === "react/jsx-runtime") return h.jsx;
    if (dep === "react-router-dom") return router;
    if (dep.includes("AuthContext")) return authModule;
    if (dep.includes("useProtectedNavigation")) return moduleCache.helper ??= load("src/auth/useProtectedNavigation.ts", resolver);
    if (dep.includes("SignInRequiredDialog")) return { SignInRequiredDialog: "dialog" };
    if (dep.includes("api/client")) return { useApi: () => ({ get, post: () => { throw Error("Unexpected POST"); }, patch: () => { throw Error("Unexpected PATCH"); } }) };
    if (dep.includes("api/leagues")) return { useLeaguesApi: () => ({ getMyLeagues: async () => (await get("/leagues/me")).leagues, getLeagueMembers: () => { throw Error("Unexpected membership read"); } }) };
    if (dep.includes("currentSeason")) return moduleCache.season ??= load("src/season/currentSeason.ts", resolver);
    if (dep.includes("bracketAccess")) return moduleCache.access ??= load("src/lib/bracketAccess.ts", resolver);
    if (dep.includes("bracketValidity")) return moduleCache.validity ??= load("src/lib/bracketValidity.ts", resolver);
    if (dep.includes("Footer")) return { Footer: "footer" };
    if (dep.includes("analytics")) return { trackEvent() {} };
    throw Error("Unexpected dependency: " + dep);
  }
  const file = name === "Footer" ? "src/components/layout/Footer.tsx" : "src/pages/" + name + ".tsx";
  const component = load(file, resolver)[name];
  h.render(component);
  return { h, calls, navigations, events,
    async flush() { for (let i = 0; i < 15; i++) { await new Promise(resolve => setImmediate(resolve)); if (h.dirty) h.render(component); } },
    setAuthenticated() { auth = { ...auth, token: "synthetic", user: { id: "viewer", username: "Fixture", is_admin: false } }; h.render(component); } };
}
const button = (p, text, last = false) => {
  const all = nodes(p.h.tree).filter(n => n.type === "button" && visible(n).trim() === text);
  assert.ok(all.length, "Missing " + text); return last ? all.at(-1) : all[0];
};
const prompt = p => nodes(p.h.tree).find(n => n.type === "dialog");
async function openMobile(p) { button(p, "Menu").props.onClick(); await p.flush(); }
const pages = ["PastSeasonsPage", "TermsPage", "FaqsPage", "BracketPage"];
const destinations = [["NBA Corner", "/dashboard"], ["Dashboard", "/dashboard"], ["My Leagues", "/leagues/info"], ["Find a League", "/leagues/find"], ["Account", "/account"]];
for (const name of pages) {
  test(name + ": all nine anonymous header/logo controls prompt without private reads or auth writes", async () => {
    const p = surface(name); await p.flush();
    const before = p.calls.slice();
    for (const mobile of [false, true]) for (const [label] of destinations) {
      if (mobile && label === "NBA Corner") continue;
      if (mobile) await openMobile(p);
      button(p, label, mobile).props.onClick(); await p.flush();
      assert.equal(prompt(p).props.open, true); assert.equal(p.navigations.length, 0);
      assert.deepEqual(p.calls, before); assert.deepEqual(p.events, []);
      if (mobile) assert.equal(nodes(p.h.tree).filter(n => n.type === "button" && visible(n).trim() === "Dashboard").length, 1);
      prompt(p).props.onDismiss(); await p.flush(); assert.equal(prompt(p).props.open, false);
    }
  });
  test(name + ": authenticated desktop/mobile protected navigation stays direct", async () => {
    const p = surface(name, true); await p.flush();
    for (const mobile of [false, true]) for (const [label, target] of destinations) {
      if (mobile && label === "NBA Corner") continue;
      if (mobile) await openMobile(p);
      button(p, label, mobile).props.onClick(); await p.flush();
      assert.equal(p.navigations.at(-1)[0], target); assert.equal(prompt(p).props.open, false);
    }
  });
  test(name + ": genuine public navigation remains direct on desktop/mobile", async () => {
    const p = surface(name); await p.flush();
    for (const mobile of [false, true]) for (const [label, target] of [["Leaderboards", "/leaderboard"], ["Past Seasons", "/past-seasons"]]) {
      if (mobile) await openMobile(p);
      button(p, label, mobile).props.onClick(); await p.flush();
      assert.equal(p.navigations.at(-1)[0], target); assert.equal(prompt(p).props.open, false);
    }
  });
}
for (const name of [...pages, "LeaderboardPage"]) {
  test(name + ": anonymous desktop/mobile Sign in is direct, with no logout action", async () => {
    const p = surface(name); await p.flush();
    for (const mobile of [false, true]) {
      if (mobile) await openMobile(p);
      assert.equal(nodes(p.h.tree).some(n => n.type === "button" && visible(n).trim() === "Logout"), false);
      button(p, "Sign in", mobile).props.onClick(); await p.flush();
      assert.equal(p.navigations.at(-1)[0], "/login"); assert.equal(prompt(p).props.open, false);
      assert.equal(p.events.includes("logout"), false);
    }
  });
  test(name + ": authenticated desktop/mobile Logout retains exact action and redirect", async () => {
    for (const mobile of [false, true]) {
      const p = surface(name, true); await p.flush(); if (mobile) await openMobile(p);
      assert.equal(nodes(p.h.tree).some(n => n.type === "button" && visible(n).trim() === "Sign in"), false);
      button(p, "Logout", mobile).props.onClick(); await p.flush();
      assert.deepEqual(p.events, ["logout", ...(["PastSeasonsPage", "LeaderboardPage"].includes(name) ? ["navigate:/login"] : [])]);
    }
  });
}
for (const authenticated of [false, true]) test("Footer Home: " + (authenticated ? "authenticated Link semantics preserved" : "anonymous dialog blocks Dashboard"), async () => {
  const p = surface("Footer", authenticated); await p.flush(); let prevented = false;
  const home = nodes(p.h.tree).find(n => n.type === "link" && n.props.to === "/dashboard");
  home.props.onClick({ preventDefault() { prevented = true; } }); await p.flush();
  assert.equal(prevented, !authenticated); assert.equal(prompt(p).props.open, !authenticated);
  assert.equal(p.calls.length, 0); assert.equal(p.events.length, 0);
  assert.equal(home.props.to, "/dashboard"); // Real Link performs the default authenticated navigation.
  assert.deepEqual(nodes(p.h.tree).filter(n => n.type === "link").map(n => n.props.to), ["/dashboard", "/terms", "/faqs"]);
  assert.equal(nodes(p.h.tree).find(n => n.type === "a").props.href, "mailto:admin@nbacorner.com");
});
test("Historical stats: anonymous prompt/cancel preserve season and selected public data", async () => {
  const p = surface("PastSeasonsPage"); await p.flush(); const before = p.calls.slice();
  button(p, "click here").props.onClick(); await p.flush();
  assert.equal(prompt(p).props.open, true); assert.equal(p.navigations.length, 0); assert.deepEqual(p.calls, before);
  assert.equal(nodes(p.h.tree).find(n => n.type === "select").props.value, "2025-26");
  prompt(p).props.onDismiss(); await p.flush(); p.setAuthenticated(); await p.flush();
  button(p, "click here").props.onClick();
  assert.equal(JSON.stringify(p.navigations.at(-1)), JSON.stringify(["/league-stats", { state: { leagueId: null, leagueName: "2025-26 season", seasonCode: "2025-26" } }]));
});
test("Historical stats: authenticated exact state and older-season visibility preserved", async () => {
  const p = surface("PastSeasonsPage", true); await p.flush(); button(p, "click here").props.onClick();
  assert.equal(JSON.stringify(p.navigations.at(-1)), JSON.stringify(["/league-stats", { state: { leagueId: null, leagueName: "2025-26 season", seasonCode: "2025-26" } }]));
  const select = nodes(p.h.tree).find(n => n.type === "select"); select.props.onChange({ target: { value: "2024-25" } }); await p.flush();
  assert.equal(nodes(p.h.tree).some(n => n.type === "button" && visible(n).trim() === "click here"), false);
  assert.ok(p.calls.includes("/leaderboard/history/2024-25"));
});
test("Historical bracket still reads only the public history endpoint and exposes no editing", async () => {
  const p = surface("BracketPage"); await p.flush();
  assert.deepEqual(p.calls, ["/history/bracket/fixture"]);
  assert.match(visible(p.h.tree), /Historical fixture|Historical bracket/);
  assert.equal(nodes(p.h.tree).some(n => n.type === "button" && /Save bracket|Undo|Download image/.test(visible(n))), false);
});
test("Current authenticated bracket keeps its existing direct header path", async () => {
  const p = surface("BracketPage", true, false); await p.flush(); button(p, "Dashboard").props.onClick();
  assert.equal(p.navigations.at(-1)[0], "/dashboard"); assert.equal(prompt(p).props.open, false);
  assert.ok(p.calls.includes("/brackets/me")); assert.ok(p.calls.includes("/bracket/fixture"));
});
