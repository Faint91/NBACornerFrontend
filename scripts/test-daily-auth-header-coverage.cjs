const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const api = "https://nba-api.fixture.example";
const policy = {
  "Content-Security-Policy": `default-src 'none'; script-src 'self'; connect-src ${api}; frame-ancestors https://www.nbacorner.com; base-uri 'none'; form-action 'none'`,
  "X-Frame-Options": "SAMEORIGIN",
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function generatedRules() {
  const source = fs.readFileSync(path.join(root, "vite.config.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    URL,
    process: { cwd: () => root, env: {} },
    require(name) {
      if (name === "vite") return { defineConfig: value => value, loadEnv: () => ({ VITE_API_URL: api }) };
      if (name === "@vitejs/plugin-react") return { default: () => ({ name: "fixture-react" }) };
      if (name === "node:path") return require(name);
      throw new Error(`Unexpected config dependency: ${name}`);
    },
  }, { filename: "vite.config.ts" });
  const config = module.exports.default({ mode: "production" });
  const assets = [];
  config.plugins.find(plugin => plugin.name === "daily-auth-helper-headers")
    .generateBundle.call({ emitFile: asset => assets.push(asset) });
  assert.equal(assets.length, 1);
  assert.equal(assets[0].fileName, "_headers");
  const rules = new Map();
  let current;
  for (const line of assets[0].source.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.startsWith("/")) {
      assert.ok(!rules.has(line), "Duplicate path rule");
      rules.set(line, current = {});
    } else {
      const match = /^\s+([^:]+):\s*(.+)$/.exec(line);
      assert.ok(current && match, "Malformed generated header block");
      current[match[1]] = match[2];
    }
  }
  return rules;
}

// Model the observed Pages contract: the .html asset redirects to a clean URL,
// whose 200 response serves that asset but matches headers by the final URL.
function pagesResponse(pathname, rules) {
  const asset = "/daily-stats-auth.html";
  if (pathname === asset) return {
    status: 308, location: "/daily-stats-auth", headers: rules.get(pathname) ?? {},
  };
  if (pathname === "/daily-stats-auth") return {
    status: 200,
    asset,
    body: fs.readFileSync(path.join(root, asset), "utf8"),
    headers: rules.get(pathname) ?? {},
  };
  return { headers: rules.get(pathname) ?? {} };
}

test("generated helper rules cover only the two exact HTML and clean paths", () => {
  assert.deepEqual([...generatedRules().keys()].sort(), ["/daily-stats-auth", "/daily-stats-auth.html"]);
});

test("Pages .html clean-URL redirect retains the full accepted helper policy", () => {
  const response = pagesResponse("/daily-stats-auth.html", generatedRules());
  assert.equal(response.status, 308);
  assert.equal(response.location, "/daily-stats-auth");
  assert.deepEqual(response.headers, policy);
});

test("final extensionless 200 serves the helper asset with every security/cache header", () => {
  const rules = generatedRules();
  const redirect = pagesResponse("/daily-stats-auth.html", rules);
  const final = pagesResponse(redirect.location, rules);
  assert.equal(final.status, 200);
  assert.equal(final.asset, "/daily-stats-auth.html");
  assert.match(final.body, /<title>Daily authentication helper<\/title>/);
  assert.doesNotMatch(final.body, /<div id="root"/);
  assert.deepEqual(final.headers, policy);
});

test("helper policy does not broaden to ordinary pages, trailing-slash paths or near misses", () => {
  const rules = generatedRules();
  for (const pathname of ["/", "/login", "/account", "/admin", "/dashboard", "/1on1", "/daily-stats-auth/", "/daily-stats-auth-other"])
    assert.deepEqual(pagesResponse(pathname, rules).headers, {}, pathname);
});
