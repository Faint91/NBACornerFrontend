const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const source = fs.readFileSync("src/pages/AdminPage.tsx", "utf8");
const tree = ts.createSourceFile("AdminPage.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function handler(name) { let found; function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) found = node.getText(tree); ts.forEachChild(node, visit); } visit(tree); assert.ok(found); return ts.transpileModule("const " + found + "; exports.run=" + name, { compilerOptions: {module: ts.ModuleKind.CommonJS} }).outputText; }
function confirm(overrides = {}) { let opened = false, error = null; const ctx = {exports: {}, user: {is_admin: true}, CURRENT_SEASON_CODE: "2025-26", newSeasonCode: "2026-27", regSeasonEnd: "2027-04-12T00:00:00Z", playoffsStart: "2027-04-18T00:00:00Z", setRolloverError: v => error = v, setRolloverConfirmOpen: v => opened = v, ...overrides}; vm.runInNewContext(handler("handleRollover"), ctx); ctx.exports.run(); return {opened,error}; }
test("rollover requires explicit confirmation and immediate target", () => { assert.equal(confirm().opened, true); for (const newSeasonCode of ["2025-26","2024-25","2027-28","bad"]) { const r=confirm({newSeasonCode}); assert.equal(r.opened,false); assert.ok(r.error); } });
test("strict timing and missing authority prevent confirmation", () => { for (const overrides of [{regSeasonEnd:""},{playoffsStart:"bad"},{playoffsStart:"2027-04-12T00:00:00Z"},{CURRENT_SEASON_CODE:null},{user:{is_admin:false}}]) assert.equal(confirm(overrides).opened,false); });
test("century rollover confirmation preserves correct suffix", () => { assert.equal(confirm({CURRENT_SEASON_CODE:"1999-00",newSeasonCode:"2000-01"}).opened,true); });
test("standalone snapshot confirmation remains independent of rollover fields", () => { let opened=false; const ctx={exports:{},user:{is_admin:true},CURRENT_SEASON_CODE:"2025-26",seasonCodeConfirm:"2025-26",setSnapshotError:()=>assert.fail(),setSnapshotConfirmOpen:v=>opened=v}; vm.runInNewContext(handler("handleSnapshot"),ctx); ctx.exports.run(); assert.equal(opened,true); });
test("UI warns of permanent draft deletion, saved history, audit and repeat outcome", () => { for (const text of ["permanently delete unsaved source-season brackets","preserve saved brackets and their match graphs","Rollover audit:","already_completed","Optional legacy history needs review"]) assert.ok(source.includes(text), text); });
