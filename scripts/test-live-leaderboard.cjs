const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const source = fs.readFileSync("src/pages/LeaderboardPage.tsx", "utf8");
const tree = ts.createSourceFile("LeaderboardPage.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const handlers = {};
function visit(node) { if (ts.isVariableDeclaration(node) && ["loadLeaderboard", "handleRecompute"].includes(node.name.getText(tree)))
    handlers[node.name.getText(tree)] = node.getText(tree); ts.forEachChild(node, visit); }
visit(tree);
function compile(name, context) { context.exports = {}; vm.runInNewContext(ts.transpileModule("const " + handlers[name] + "; exports.run=" + name + ";", { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context); return context.exports.run; }
function loader(get, scope = null) { let rows = null, error = null; const context = { selectedLeagueId: scope, leaderboardRequest: { current: 0 }, setError: v => { error = v; }, setLoading: () => { }, setRows: v => { rows = v; }, setMasterMatchups: () => { }, get, encodeURIComponent, console: { error: () => { } } }; return { run: compile("loadLeaderboard", context), rows: () => rows, error: () => error }; }
test("preserves backend order and true tie ranks even when names sort differently", async () => { const expected = [{ bracket_id: "z", username: "Zulu", rank: 1, total_points: 5 }, { bracket_id: "a", username: "Alpha", rank: 1, total_points: 5 }, { bracket_id: "c", rank: 3, total_points: 2 }]; const l = loader(async (path) => { assert.equal(path, "/leaderboard"); return { rows: expected }; }); await l.run(); assert.deepEqual(Array.from(l.rows(), r => [r.bracket_id, r.rank]), [["z", 1], ["a", 1], ["c", 3]]); });
test("requests server ranks for selected league scope", async () => { const l = loader(async (path) => { assert.equal(path, "/leaderboard?league_id=fixture%20league"); return { rows: [] }; }, "fixture league"); await l.run(); });
test("stale response cannot overwrite later competitive scope result", async () => { const pending = []; const l = loader(() => new Promise(resolve => pending.push(resolve))); const first = l.run(); const second = l.run(); pending[1]({ rows: [{ bracket_id: "new", rank: 1 }] }); await second; pending[0]({ rows: [{ bracket_id: "old", rank: 4 }] }); await first; assert.equal(l.rows()[0].bracket_id, "new"); });
test("manual recompute supplies no master or season authority", async () => { const calls = []; let reloads = 0; const context = { setRecomputing: () => { }, setError: () => { }, post: async (path, body) => { calls.push([path, body]); }, loadLeaderboard: async () => { reloads++; }, console: { error: () => { } } }; await compile("handleRecompute", context)(); assert.equal(calls[0][0], "/admin/score/recompute"); assert.equal(JSON.stringify(calls[0][1]), "{}"); assert.equal(reloads, 1); });
test("manual recompute failure surfaces error without success reload", async () => { let error = null, reloads = 0; const context = { setRecomputing: () => { }, setError: v => { error = v; }, post: async () => { throw new Error("Recompute failed"); }, loadLeaderboard: async () => { reloads++; }, console: { error: () => { } } }; await compile("handleRecompute", context)(); assert.equal(error, "Recompute failed"); assert.equal(reloads, 0); });
test("renders backend rank without local sequential fallback", () => { assert.ok(source.includes("{r.rank}")); assert.ok(!source.includes("{idx + 1}")); assert.ok(!source.includes("cleaned.sort(")); });
