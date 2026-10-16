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
function form(name, initial, status) {
  const state = [...initial]; let index = 0; const requests = [], navigation = [], sessions = [];
  const react = { useState: value => { const i = index++; if (!(i in state)) state[i] = typeof value === "function" ? value() : value; return [state[i], next => { state[i] = next; }]; } };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const component = load(`src/pages/${name}Page.tsx`, module => module === "react" ? react : module === "react/jsx-runtime" ? jsx : module.includes("identityPolicy") ? policy : module.includes("react-router") ? { useNavigate: () => (...args) => navigation.push(args), useLocation: () => ({ state: {} }), Link: "a" } : module.includes("AuthContext") ? { useAuth: () => ({ login: value => sessions.push(value) }) } : { trackEvent: () => {} }, { fetch: async (url, request) => { requests.push(JSON.parse(request.body)); return { ok: status === 200 || status === 201, status, json: async () => ({ error: "private SQL diagnostics", token: "synthetic", user: { id: "synthetic" } }) }; } })[name + "Page"];
  function all(node) { return !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(all)]; }
  const tree = component(); const submit = all(tree).find(node => node.type === "form").props.onSubmit;
  return { state, requests, sessions, navigation, submit: () => submit({ preventDefault() {} }) };
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
