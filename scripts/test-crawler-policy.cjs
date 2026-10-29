const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const text = fs.readFileSync("public/robots.txt", "utf8");
const directives = text.split(/\r?\n/).filter(line => line.trim() && !line.startsWith("#"))
  .map(line => {
    const colon = line.indexOf(":");
    assert.ok(colon > 0, "Every robots directive needs a field name");
    return [line.slice(0, colon).toLowerCase(), line.slice(colon + 1).trim()];
  });
const values = name => directives.filter(([key]) => key === name).map(([, value]) => value);

test("NBA host-root robots advertises the Daily sitemap without inventing an NBA sitemap", () => {
  assert.doesNotMatch(text, /<!doctype|<html/i);
  assert.deepEqual(values("user-agent"), ["*"]);
  assert.deepEqual(values("sitemap"), ["https://www.nbacorner.com/1on1/sitemap.xml"]);
  const sitemap = new URL(values("sitemap")[0]);
  assert.equal(sitemap.origin, "https://www.nbacorner.com");
  assert.equal(sitemap.pathname, "/1on1/sitemap.xml");
  assert.equal(sitemap.search + sitemap.hash, "");
});

test("default NBA crawl access is preserved; only Daily API/stats paths are discouraged", () => {
  assert.deepEqual(values("allow"), ["/"]);
  assert.deepEqual(values("disallow"), ["/1on1/api/", "/1on1/stats/"]);
  const allowed = path => !values("disallow").some(prefix => path.startsWith(prefix));
  for (const path of ["/", "/dashboard", "/leaderboards", "/past-seasons", "/account", "/api/", "/stats/",
    "/1on1", "/1on1/", "/1on1/matchups", "/1on1/rules", "/1on1/image-credits",
    "/1on1/matchup/2026-10-28", "/1on1/sitemap.xml", "/1on1/_next/static/app.js"])
    assert.equal(allowed(path), true, path);
  for (const path of ["/1on1/api/health", "/1on1/api/cron/social-prepare", "/1on1/stats/example"])
    assert.equal(allowed(path), false, path);
  assert.equal(values("disallow").includes("/1on1"), false);
});

test("the static policy stays independent of runtime routing and subpath robots", () => {
  assert.deepEqual([...new Set(directives.map(([key]) => key))].sort(),
    ["allow", "disallow", "sitemap", "user-agent"]);
  assert.equal(values("sitemap").some(url => url.includes("1on1ball.com") || url.endsWith("robots.txt")), false);
  assert.equal(fs.existsSync("public/sitemap.xml"), false);
  assert.equal(fs.existsSync("public/_redirects"), false);
  assert.equal(fs.existsSync("public/_headers"), false);
});
