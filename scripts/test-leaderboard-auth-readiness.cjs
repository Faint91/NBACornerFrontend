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
function page({ ready = false, token = null, leagues } = {}) {
  const h = hooks(), calls = [];
  let auth = { authReady: ready, token, user: token ? { id: "fixture", username: "Fixture" } : null, logout() { throw Error("Unexpected logout"); } };
  const authModule = { useAuth: () => auth };
  const api = load("src/api/client.ts", () => authModule, { fetch: async (url, options) => {
    const path = url.replace("https://fixture.invalid", "");
    calls.push({ path, ...options });
    assert.equal(options.method, "GET");
    if (path === "/leagues/me") {
      if (leagues) return leagues();
      return { ok: true, status: 200, json: async () => ({ leagues: [{ id: "league-a", name: "Fixture league" }] }) };
    }
    return { ok: true, status: 200, json: async () => path.includes("/members") ? { members: [] } : { rows: [], master_matchups: {} } };
  } });
  const leagueApi = load("src/api/leagues.ts", () => api);
  const component = load("src/pages/LeaderboardPage.tsx", name => {
    if (name === "react") return h.react;
    if (name === "react/jsx-runtime") return h.jsx;
    if (name.includes("AuthContext")) return authModule;
    if (name.includes("api/client")) return api;
    if (name.includes("api/leagues")) return leagueApi;
    if (name.includes("react-router")) return { useNavigate: () => () => {}, useLocation: () => ({ state: null }) };
    return { Footer: "footer", trackEvent() {} };
  }).LeaderboardPage;
  h.render(component);
  return { calls, h, async flush() {
    for (let i = 0; i < 12; i++) { await new Promise(resolve => setImmediate(resolve)); if (h.dirty) h.render(component); }
  }, setAuth(next) { auth = { ...auth, ...next }; h.render(component); }, rerender() { h.render(component); } };
}

test("pending restoration loads public leaderboard without protected request or auth error", async () => {
  const p = page(); await p.flush();
  assert.equal(p.calls.filter(x => x.path === "/leaderboard").length, 1);
  assert.equal(p.calls.filter(x => x.path === "/leagues/me").length, 0);
  assert.doesNotMatch(visible(p.h.tree), /Authorization/);
});
test("confirmed anonymous keeps global leaderboard and never requests private leagues", async () => {
  const p = page(); await p.flush(); p.setAuth({ authReady: true }); await p.flush();
  assert.equal(p.calls.filter(x => x.path === "/leagues/me").length, 0);
  assert.equal(nodes(p.h.tree).find(x => x.type === "select").props.value, "");
  assert.doesNotMatch(visible(p.h.tree), /Authorization|Loading leagues/);
});
test("restored token waits for readiness, attaches Authorization, loads league and preserves selector", async () => {
  const p = page({ token: "synthetic-a" }); await p.flush();
  assert.equal(p.calls.filter(x => x.path === "/leagues/me").length, 0);
  p.setAuth({ authReady: true }); await p.flush();
  const calls = p.calls.filter(x => x.path === "/leagues/me"); assert.equal(calls.length, 1);
  assert.equal(calls[0].headers.Authorization, "Bearer synthetic-a");
  assert.match(visible(p.h.tree), /Fixture league/);
  assert.ok(p.calls.some(x => x.path === "/leaderboard?league_id=league-a"));
  nodes(p.h.tree).find(x => x.type === "select").props.onChange({ target: { value: "" } }); await p.flush();
  assert.equal(nodes(p.h.tree).find(x => x.type === "select").props.value, "");
  assert.equal(p.calls.at(-1).path, "/leaderboard");
  p.rerender(); p.rerender(); await p.flush();
  assert.equal(p.calls.filter(x => x.path === "/leagues/me").length, 1);
});
test("genuine authenticated league failure remains visible and clears after auth transition", async () => {
  let fail = true;
  const p = page({ ready: true, token: "synthetic-a", leagues: async () => ({ ok: !fail, status: fail ? 503 : 200, json: async () => fail ? { error: "League service unavailable" } : { leagues: [] } }) });
  await p.flush(); assert.match(visible(p.h.tree), /League service unavailable/);
  fail = false; p.setAuth({ token: "synthetic-b" }); await p.flush();
  assert.doesNotMatch(visible(p.h.tree), /League service unavailable/);
});
test("stale failure cannot overwrite a newer session league result", async () => {
  let release;
  const p = page({ ready: true, token: "synthetic-a", leagues: () => new Promise(resolve => { release = resolve; }) });
  await p.flush();
  p.setAuth({ authReady: true, token: null, user: null }); await p.flush();
  release({ ok: false, status: 503, json: async () => ({ error: "Obsolete error" }) }); await p.flush();
  assert.doesNotMatch(visible(p.h.tree), /Obsolete error|Fixture league/);
  assert.equal(nodes(p.h.tree).find(x => x.type === "select").props.value, "");
});
test("stale success cannot repopulate leagues after auth loss", async () => {
  let release;
  const p = page({ ready: true, token: "synthetic-a", leagues: () => new Promise(resolve => { release = resolve; }) });
  await p.flush(); p.setAuth({ token: null, user: null }); await p.flush();
  release({ ok: true, status: 200, json: async () => ({ leagues: [{ id: "old", name: "Obsolete league" }] }) }); await p.flush();
  assert.doesNotMatch(visible(p.h.tree), /Obsolete league/);
});
test("auth provider distinguishes restoring, anonymous and restored sessions without rewriting storage", () => {
  for (const stored of [false, true]) {
    const h = hooks(), writes = [];
    const component = load("src/auth/AuthContext.tsx", name => name === "react" ? h.react : name === "react/jsx-runtime" ? h.jsx : { setUserId() {}, trackEvent() {} }, { localStorage: { getItem: key => !stored ? null : key === "auth_token" ? "synthetic" : JSON.stringify({ id: "fixture" }), setItem: (...args) => writes.push(args), removeItem: key => writes.push(key) } }).AuthProvider;
    const first = h.render(() => component({ children: null })); assert.equal(first.props.value.authReady, false);
    const restored = h.render(() => component({ children: null })).props.value;
    assert.equal(restored.authReady, true); assert.equal(restored.token, stored ? "synthetic" : null);
    assert.equal(writes.length, 0);
  }
});
