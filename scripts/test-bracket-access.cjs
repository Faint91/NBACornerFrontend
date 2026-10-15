const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const source = fs.readFileSync("src/lib/bracketAccess.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const sandbox = { exports: {}, require, setInterval, clearInterval };
vm.runInNewContext(compiled, sandbox);
const { deadlineReached, bracketContentAccess, bracketCreationDisabled } = sandbox.exports;

test("canonical deadline: before editable, at/after locked", () => {
  const iso = "2026-04-18T19:00:00Z", at = Date.parse(iso);
  assert.equal(deadlineReached(iso, at - 1), false);
  assert.equal(deadlineReached(iso, at), true);
  assert.equal(deadlineReached(iso, at + 1), true);
});
test("all owner/admin/master/lock/loading combinations", () => {
  for (const isOwner of [false,true]) for (const isAdmin of [false,true])
  for (const isMaster of [false,true]) for (const locked of [false,true])
  for (const ready of [false,true]) {
    const policy = bracketContentAccess({isOwner,isAdmin,isMaster,locked,ready});
    assert.equal(policy.canEdit, (isAdmin && isMaster) || (isOwner && !isAdmin && !isMaster && !locked && ready));
  }
});
test("creation final lock overrides opening; only admin bypasses window", () => {
  for (const isAdmin of [false,true]) for (const locked of [false,true])
  for (const creationOpen of [false,true]) for (const ready of [false,true]) {
    assert.equal(bracketCreationDisabled({creating:false,hasBracket:false,isAdmin,locked,creationOpen,ready}), !isAdmin && (!ready || !creationOpen || locked));
  }
});
test("existing bracket and pending create still disable creation", () => {
  for (const isAdmin of [false,true]) {
    assert.equal(bracketCreationDisabled({creating:true,hasBracket:false,isAdmin,locked:false,creationOpen:true,ready:true}), true);
    assert.equal(bracketCreationDisabled({creating:false,hasBracket:true,isAdmin,locked:false,creationOpen:true,ready:true}), true);
  }
});
