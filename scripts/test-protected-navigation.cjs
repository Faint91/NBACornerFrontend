const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
function load(file, requireHook, extra = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: requireHook, fetch: () => { throw Error("Unexpected protected request"); }, ...extra });
  return exports;
}
function navigation(token = null) {
  let message = null, value;
  const navigations = [];
  const hook = load("src/auth/useProtectedNavigation.ts", name => {
    if (name === "react") return { useState: () => [message, next => { message = next; }] };
    if (name.includes("AuthContext")) return { useAuth: () => ({ token }) };
    if (name === "react-router-dom") return { useNavigate: () => (...args) => navigations.push(args) };
    throw Error("Unexpected dependency");
  }).useProtectedNavigation;
  const render = () => value = hook(); render();
  return { render, navigations, get value() { return value; } };
}

test("anonymous protected click opens prompt without routing, storage or protected requests", () => {
  const h = navigation(); h.value.navigateProtected("/bracket/fixture", undefined, "View this bracket"); h.render();
  assert.equal(h.value.prompt.open, true); assert.equal(h.value.prompt.message, "View this bracket");
  assert.equal(h.navigations.length, 0);
});
test("Sign in closes prompt and uses existing login route without a pending destination", () => {
  const h = navigation(); h.value.navigateProtected("/bracket/fixture"); h.render(); h.value.prompt.onSignIn(); h.render();
  assert.equal(h.value.prompt.open, false); assert.equal(JSON.stringify(h.navigations), '[["/login"]]');
});
test("Create account uses existing register route without automatic forwarding", () => {
  const h = navigation(); h.value.navigateProtected("/bracket/fixture"); h.render(); h.value.prompt.onCreateAccount(); h.render();
  assert.equal(h.value.prompt.open, false); assert.equal(JSON.stringify(h.navigations), '[["/register"]]');
});
test("cancel leaves current route untouched and repeated opens have no stale destination", () => {
  const h = navigation();
  for (let i = 0; i < 4; i++) { h.value.navigateProtected("/bracket/" + i); h.render(); assert.equal(h.value.prompt.open, true); h.value.prompt.onDismiss(); h.render(); assert.equal(h.value.prompt.open, false); }
  assert.equal(h.navigations.length, 0);
});
test("authenticated click navigates directly and preserves route state", () => {
  const h = navigation("synthetic-session"), options = { state: { leagueId: "fixture" } };
  h.value.navigateProtected("/league-stats", options); h.render();
  assert.equal(h.value.prompt.open, false); assert.equal(h.navigations[0][0], "/league-stats"); assert.equal(h.navigations[0][1], options);
});
function dialog(open) {
  let effect, cleanup, shows = 0, closes = 0, dismissed = 0, signedIn = 0, registered = 0, id = 0;
  const native = { open: false, showModal() { this.open = true; shows++; }, close() { this.open = false; closes++; } };
  const react = { useRef: () => ({ current: native }), useId: () => "fixture-" + id++, useEffect: fn => { effect = fn; } };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const component = load("src/components/auth/SignInRequiredDialog.tsx", name => name === "react" ? react : jsx).SignInRequiredDialog;
  const tree = component({ open, message: "View this bracket", onDismiss() { dismissed++; }, onSignIn() { signedIn++; }, onCreateAccount() { registered++; } });
  cleanup = effect();
  return { tree, native, cleanup, get shows() { return shows; }, get closes() { return closes; }, get dismissed() { return dismissed; }, get signedIn() { return signedIn; }, get registered() { return registered; } };
}
function nodes(n) { return !n || typeof n !== "object" ? [] : [n, ...[n.props?.children].flat(Infinity).flatMap(nodes)]; }
test("native modal opens only when requested and closes on teardown", () => {
  const closed = dialog(false); assert.equal(closed.shows, 0);
  const h = dialog(true); assert.equal(h.tree.type, "dialog"); assert.equal(h.shows, 1); h.cleanup(); assert.equal(h.closes, 1);
});
test("dialog has labelled title/description and an obvious Cancel action", () => {
  const h = dialog(true), all = nodes(h.tree);
  assert.ok(all.some(n => n.type === "h2" && n.props.id === h.tree.props["aria-labelledby"]));
  assert.ok(all.some(n => n.type === "p" && n.props.id === h.tree.props["aria-describedby"]));
  const cancel = all.find(n => n.type === "button" && n.props.children === "Cancel"); assert.ok(cancel); cancel.props.onClick(); assert.equal(h.dismissed, 1);
});
test("Escape/native close dismiss without navigation and authentication buttons remain explicit", () => {
  const h = dialog(true); let prevented = false;
  h.tree.props.onCancel({ preventDefault() { prevented = true; } }); assert.equal(prevented, true); assert.equal(h.dismissed, 1);
  h.tree.props.onClose(); assert.equal(h.dismissed, 2); assert.equal(h.signedIn + h.registered, 0);
  nodes(h.tree).find(n => n.type === "button" && n.props.children === "Sign in").props.onClick();
  nodes(h.tree).find(n => n.type === "button" && n.props.children === "Create account").props.onClick();
  assert.equal(h.signedIn, 1); assert.equal(h.registered, 1);
});
