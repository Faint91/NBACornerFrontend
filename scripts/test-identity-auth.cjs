const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
function load(file, hook, extra = {}) {
  const source = fs.readFileSync(file, "utf8").replaceAll("import.meta.env.VITE_API_URL", JSON.stringify("http://synthetic.invalid"));
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {}; vm.runInNewContext(output, { exports, require: hook, Error, ...extra }); return exports;
}
const policy = load("src/auth/identityPolicy.ts", () => { throw Error("Unexpected dependency"); });
test("registration preserves exact passwords, trimmed display case and Unicode codepoint limits", () => {
  const value = policy.registrationPayload(" USER@EXAMPLE.TEST ", " MiXeD ", " abcdefgh ");
  assert.equal(value.username, "MiXeD"); assert.equal(value.email, "USER@EXAMPLE.TEST"); assert.equal(value.password, " abcdefgh ");
  for (const password of ["a".repeat(8), "a".repeat(128), "😀".repeat(128), " ".repeat(8)]) assert.equal(policy.registrationPayload("x@y.z", "Name", password).password, password);
  for (const password of ["a".repeat(7), "😀".repeat(129)]) assert.throws(() => policy.registrationPayload("x@y.z", "Name", password));
});
test("login preserves both existing identity types and exact password", async () => {
  for (const identity of [" UserName ", " USER@EXAMPLE.TEST "]) {
    const value = policy.loginPayload(identity, " abcdefgh "); assert.equal(value.password, " abcdefgh ");
    assert.equal(value.email || value.username, identity.trim());
  }
  const calls = []; const api = load("src/api/auth.ts", name => name.includes("identityPolicy") ? policy : { apiPost: async (path, body) => { calls.push([path, body]); } });
  await api.login(" MiXeD ", " abcdefgh "); assert.equal(calls[0][1].password, " abcdefgh "); assert.equal(calls[0][1].username, "MiXeD");
});
const returnPolicy = load("src/auth/dailyReturnPath.ts", () => { throw Error("Unexpected dependency"); }, { URLSearchParams });
function form(name, initial, status, search = "") {
  const state = [...initial]; let index = 0; const requests = [], navigation = [], sessions = [], documents = [], order = [];
  const react = { useState: value => { const i = index++; if (!(i in state)) state[i] = typeof value === "function" ? value() : value; return [state[i], next => { state[i] = next; }]; } };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const component = load(`src/pages/${name}Page.tsx`, module => module === "react" ? react : module === "react/jsx-runtime" ? jsx : module.includes("identityPolicy") ? policy : module.includes("dailyReturnPath") ? returnPolicy : module.includes("react-router") ? { useNavigate: () => (...args) => navigation.push(args), useLocation: () => ({ state: {}, search }), Link: "a" } : module.includes("AuthContext") ? { useAuth: () => ({ login: value => { sessions.push(value); order.push("session"); } }) } : { trackEvent: () => {} }, { window: { location: { replace: path => { documents.push(path); order.push("document"); } } }, fetch: async (url, request) => { requests.push(JSON.parse(request.body)); return { ok: status === 200 || status === 201, status, json: async () => ({ error: "private SQL diagnostics", token: "synthetic", user: { id: "synthetic" } }) }; } })[name + "Page"];
  function all(node) { return !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(all)]; }
  const tree = all(component()); const submit = tree.find(node => node.type === "form").props.onSubmit;
  return { state, requests, sessions, navigation, documents, order, clickLinks: label => tree.filter(node => node.type === "button" && typeof node.props.children === "string" && node.props.children.toLowerCase() === label).forEach(node => node.props.onClick()), submit: () => submit({ preventDefault() {} }) };
}
test("registration form submits exact password and safely displays conflicts", async () => {
  const h = form("Register", [" USER@EXAMPLE.TEST ", " MiXeD ", " abcdefgh ", " abcdefgh ", null, false], 409);
  await h.submit(); assert.equal(h.requests[0].password, " abcdefgh "); assert.equal(h.requests[0].username, "MiXeD"); assert.equal(h.state[4], "Email or username already in use"); assert.equal(h.navigation.length, 0);
});
test("registration policy and confirmation stop invalid submissions without altering password", async () => {
  for (const values of [["short", "short"], [" abcdefgh ", "abcdefgh"]]) {
    const h = form("Register", ["x@y.z", "Name", ...values, null, false], 201); await h.submit(); assert.equal(h.requests.length, 0); assert.ok(h.state[4]);
  }
});
test("login form generic failure ignores raw error and successful session behavior stays intact", async () => {
  const fail = form("Login", [" MiXeD ", " abcdefgh ", null, false], 401); await fail.submit(); assert.equal(fail.state[2], "Invalid username/email or password"); assert.equal(fail.requests[0].password, " abcdefgh "); assert.equal(fail.sessions.length, 0);
  const ok = form("Login", [" USER@EXAMPLE.TEST ", " abcdefgh ", null, false], 200); await ok.submit(); assert.equal(ok.sessions.length, 1); assert.equal(ok.navigation[0][0], "/dashboard");
});
test("client-facing error contracts never expose supplied server diagnostics", () => {
  for (const status of [400, 401, 409, 422, 429, 500, 503]) { assert.equal(typeof policy.registrationError(status), "string"); assert.equal(typeof policy.loginError(status), "string"); }
  assert.equal(policy.loginError(400), policy.loginError(401));
});

const daily = "/1on1/matchup/2028-02-29";
const returnSearch = path => "?" + new URLSearchParams({ returnTo: path });
test("Daily return accepts only one canonical matchup with a real date", () => {
  assert.equal(returnPolicy.readDailyReturnPath(returnSearch(daily)), daily);
  assert.equal(returnPolicy.readDailyReturnPath("?returnTo=" + daily), daily);
  for (const unsafe of [
    "", "/1on1", "//evil.test", "https://www.nbacorner.com" + daily,
    "/1on1%2Fmatchup/2028-02-29", "/1on1\\matchup/2028-02-29",
    "/1on1/./matchup/2028-02-29", daily + "#x", daily + "?x=y", daily + "\n",
    " " + daily, daily + " ", "/1on1/matchup/2026-02-29",
    "/1on1/matchup/1900-02-29", "/1on1/matchup/0000-01-01",
    "/1on1/matchup/2026-04-31", "/1on1/matchup/2026-00-12",
  ]) {
    assert.equal(returnPolicy.readDailyReturnPath(returnSearch(unsafe)), null, unsafe);
    assert.equal(returnPolicy.dailyAuthPath("/login", unsafe), "/login");
  }
  assert.equal(returnPolicy.readDailyReturnPath(returnSearch(daily) + "&return%54o=" + daily), null);
});

test("registration and both responsive links preserve only validated return intent", async () => {
  const h = form("Register", ["demo@example.test", "Demo", "abcdefgh", "abcdefgh"], 201, returnSearch(daily));
  h.clickLinks("log in");
  await h.submit();
  const login = "/login" + returnSearch(daily);
  assert.deepEqual(h.navigation.map(([path]) => path), [login, login, login]);
  assert.equal(h.navigation[2][1].state.email, "demo@example.test");
  assert.equal(h.navigation[2][1].state.registered, true);
  assert.equal(h.navigation[2][1].replace, true);
  const loginForm = form("Login", ["Demo", "abcdefgh"], 200, returnSearch(daily));
  loginForm.clickLinks("sign up for free");
  assert.deepEqual(loginForm.navigation.map(([path]) => path), Array(2).fill("/register" + returnSearch(daily)));
});

test("successful sign-in writes the session before a dated document navigation", async () => {
  const h = form("Login", ["Demo", "abcdefgh"], 200, returnSearch(daily));
  await h.submit();
  assert.deepEqual(h.order, ["session", "document"]);
  assert.deepEqual(h.documents, [daily]);
  assert.deepEqual(h.navigation, []);
  const bad = form("Login", ["Demo", "abcdefgh"], 200, returnSearch("//evil.test"));
  await bad.submit();
  assert.deepEqual(bad.navigation, [["/dashboard"]]);
  assert.deepEqual(bad.documents, []);
  const denied = form("Login", ["Demo", "abcdefgh"], 401, returnSearch(daily));
  await denied.submit();
  assert.deepEqual(denied.order, []);
  assert.deepEqual(denied.navigation, []);
});
