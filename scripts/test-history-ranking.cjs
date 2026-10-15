const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync('src/pages/PastSeasonsPage.tsx', 'utf8');
const tree = ts.createSourceFile('PastSeasonsPage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let expression;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'rank') expression = node.initializer.getText(tree);
  ts.forEachChild(node, visit);
}
visit(tree);
function shown(row, idx) { return vm.runInNewContext(expression, { row, idx }); }
test('stored true ties render 1,2,2,4 without sequential reranking', () => {
  assert.deepEqual([1,2,2,4].map((rank,idx) => shown({rank},idx)), [1,2,2,4]);
});
test('missing legacy rank is unknown rather than a fabricated competition placement', () => {
  assert.equal(shown({},9), '—');
  assert.equal(shown({rank:null},3), '—');
});
test('historical competitors are never sorted by current points or username', () => {
  assert.ok(!/historyRows\s*\.\s*sort\s*\(/.test(source));
  assert.ok(!source.includes(': idx + 1;'));
});
