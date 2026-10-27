const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function loadSource(source, requireHook, extra = {}) {
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: requireHook, ...extra });
  return exports;
}

function pageHeader(page) {
  const source = fs.readFileSync(`src/pages/${page}.tsx`, "utf8");
  const ast = ts.createSourceFile(page, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = [];
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "Header") found.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (found.length !== 1) throw Error(`Expected one shared Header in ${page}`);
  return found[0];
}

function headerHarness({ page, user = null, token = user ? "fixture" : null, historical = true, props = {} } = {}) {
  let open = false;
  const events = [];
  const navigate = path => events.push(`navigate:${path}`);
  const navigateProtected = path => events.push(`${token ? "navigate" : "prompt"}:${path}`);
  const jsx = (type, properties) => typeof type === "function" ? type(properties) : ({ type, props: properties });
  const runtime = { jsx, jsxs: jsx };
  const Header = loadSource(fs.readFileSync("src/components/layout/Header.tsx", "utf8"), name => {
    if (name === "react/jsx-runtime") return runtime;
    if (name === "react") return { useState: () => [open, value => { open = typeof value === "function" ? value(open) : value; }] };
    if (name === "react-router-dom") return { useNavigate: () => navigate };
    if (name.includes("AuthContext")) return { useAuth: () => ({ user, logout: () => events.push("logout") }) };
    throw Error(`Unexpected header dependency: ${name}`);
  }).Header;
  const renderPageHeader = page ? loadSource(`export function render() { return (${pageHeader(page)}); }`, name => {
    if (name === "react/jsx-runtime") return runtime;
    throw Error(`Unexpected page-header dependency: ${name}`);
  }, { Header, historicalRoute: historical, navigateProtected }).render : () => Header(props);
  return { events, render: renderPageHeader, isOpen: () => open };
}

function nodes(node) {
  return !node || typeof node !== "object" ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
}
function text(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  return !node || typeof node !== "object" ? "" : [node.props?.children].flat(Infinity).map(text).join("").trim();
}

module.exports = { headerHarness, nodes, text, pageHeader };
