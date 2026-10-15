const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const source = fs.readFileSync("src/lib/bracketValidity.ts", "utf8");
const sandbox = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, sandbox);
const { bracketSubmissionReady } = sandbox.exports;
const rows = JSON.parse(execFileSync("python", ["-B", "-c", "import sys,json; sys.path.insert(0,'tests/offline'); from test_bracket_validity import complete; print(json.dumps(complete()))"], { cwd: "../backend", encoding: "utf8" }));
test("complete ordinary graph ready; missing matches and unresolved participants not ready", () => {
  assert.equal(bracketSubmissionReady(rows), true);
  assert.equal(bracketSubmissionReady([]), false);
  assert.equal(bracketSubmissionReady(rows.slice(1)), false);
  for (const field of ["team_a", "team_b", "predicted_winner", "predicted_winner_games"]) {
    const changed = structuredClone(rows); changed.at(-1)[field] = null;
    assert.equal(bracketSubmissionReady(changed), false);
  }
});
test("strict counts, canonical play-in, stale participant and foreign winner rejected", () => {
  for (const value of [0,-1,3,8,4.0 + 0.5,"4",true]) {
    const changed = structuredClone(rows); changed.at(-1).predicted_winner_games = value;
    assert.equal(bracketSubmissionReady(changed), false);
  }
  for (const change of [{predicted_winner_games:4}, {predicted_winner:"foreign"}]) {
    const changed = structuredClone(rows); Object.assign(changed[0],change);
    assert.equal(bracketSubmissionReady(changed), false);
  }
});
test("frontend keeps B1 access, incomplete-master exception and server graph refresh", () => {
  const page = fs.readFileSync("src/pages/BracketPage.tsx", "utf8");
  assert.ok(page.includes("bracketContentAccess({"));
  assert.ok(page.includes("(allDecided || (isAdmin && isMaster))"));
  assert.ok(page.includes("await reloadPredictionState(match.id)"));
  assert.ok(page.includes("m.round > 0 && hasTeams"));
  assert.ok(page.includes("[4, 5, 6, 7]"));
  assert.ok(page.includes("disabled={!hasTeams || !canEdit || isUpdating}"));
});
