const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const sandbox = { exports: {}, Date, Error, Number };
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/season/currentSeason.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, sandbox);
const load = sandbox.exports.loadCurrentSeason;
const fixture = { season_code: "2025-26", bracket_creation_opens_at: "2026-04-12T07:00:00Z", playoff_lock_at: "2026-04-18T07:00:00Z", standings_freeze_reached: true, playoffs_locked: false, bracket_creation_open: true };
test("accept backend canonical identity and distinct status", async () => { const result = await load(async () => fixture); assert.equal(result.season_code, "2025-26"); assert.equal(result.standings_freeze_reached, true); assert.equal(result.playoffs_locked, false); });
test("configuration fetch failure refuses", async () => { await assert.rejects(load(async () => { throw new Error("Unavailable"); })); });
test("missing timing or flags refuse without fallback", async () => { for (const key of Object.keys(fixture)) { const row = { ...fixture }; delete row[key]; await assert.rejects(load(async () => row)); } });
test("invalid configuration refuses", async () => { for (const row of [null, {}, { ...fixture, playoff_lock_at: "bad" }, { ...fixture, season_code: "bad" }]) await assert.rejects(load(async () => row)); });
test("admin and history derive from backend rather than build env", () => { for (const file of ["AdminPage", "PastSeasonsPage"]) { const source = fs.readFileSync(`src/pages/${file}.tsx`, "utf8"); assert.ok(!source.includes("import.meta.env.VITE_CURRENT_SEASON")); assert.ok(source.includes(file === "AdminPage" ? "useCurrentSeason()" : 'get("/season")')); } const admin = fs.readFileSync("src/pages/AdminPage.tsx", "utf8"); assert.ok(admin.includes('!CURRENT_SEASON_CODE')); assert.ok(admin.includes('season?.season_code')); });
test("async hook clears authority on failure; existing deadline controls remain", () => { const hook = fs.readFileSync("src/season/useCurrentSeason.ts", "utf8"); assert.ok(hook.includes("setSeason(null)")); assert.ok(hook.includes("if (!response.ok) throw")); const page = fs.readFileSync("src/pages/DashboardPage.tsx", "utf8"); assert.ok(page.includes("typeof mineEnv.playoffs_locked")); assert.ok(page.includes("typeof mineEnv.bracket_creation_open")); });


// Exercise the real admin handler: only a successful transition invalidates authority.
const adminTree = ts.createSourceFile("AdminPage.tsx", fs.readFileSync("src/pages/AdminPage.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let rolloverHandler;
function findRollover(node) { if (ts.isVariableDeclaration(node) && node.name.getText(adminTree) === "runRollover") rolloverHandler = node.getText(adminTree); ts.forEachChild(node, findRollover); }
findRollover(adminTree);
async function rolloverResponse(response, rejects = false) {
  let refreshes = 0, result = null, error = null;
  const context = { exports: {}, user: {is_admin: true}, CURRENT_SEASON_CODE: "2025-26", newSeasonCode: "2026-27", regSeasonEnd: "2027-04-12T07:00:00Z", playoffsStart: "2027-04-18T07:00:00Z", setRolloverLoading: () => {}, setRolloverError: value => { error = value; }, setRolloverResult: value => { result = value; }, refreshSeason: () => { refreshes++; }, post: async (path, payload) => { assert.equal(path, "/admin/season/rollover"); assert.equal(payload.new_season_code, "2026-27"); if (rejects) throw new Error("Transition refused"); return response; } };
  vm.runInNewContext(ts.transpileModule("const " + rolloverHandler + "; exports.run=runRollover;", {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText, context);
  await context.exports.run();
  return {refreshes, result, error};
}
test("successful rollover refetches canonical season immediately", async () => { const r = await rolloverResponse({ok: true}); assert.equal(r.refreshes, 1); assert.equal(r.result.ok, true); });
test("failed rollover does not falsely activate frontend season", async () => { for (const rejects of [false, true]) { const r = await rolloverResponse({ok: false}, rejects); assert.equal(r.refreshes, 0); if (rejects) assert.equal(r.error, "Transition refused"); } });
test("rollover confirmation reflects atomic activation and reset", () => { const source = fs.readFileSync("src/pages/AdminPage.tsx", "utf8"); assert.ok(source.includes("activates the new canonical season and clears current standings")); assert.ok(!source.includes("activation pending")); });
