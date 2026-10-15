const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const ts=require("typescript");
const vm=require("node:vm");
const page=fs.readFileSync("src/pages/DashboardPage.tsx","utf8");
const tree=ts.createSourceFile("DashboardPage.tsx",page,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let handler;
function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==="handleCreateBracket")handler=node.getText(tree);ts.forEachChild(node,visit);}
visit(tree);
async function run({isAdmin,masterExists,answer=true,disabled=false}){
 const calls=[],confirmations=[];
 const sandbox={exports:{},isAdmin,masterExists,createDisabled:disabled,
  setCreating:()=>{},setError:()=>{},post:async(path,payload)=>{calls.push({path,payload});return {bracket:{id:"fixture"}};},
  navigate:()=>{},trackEvent:()=>{},console,window:{confirm:(message)=>{confirmations.push(message);return answer;}}};
 vm.runInNewContext(ts.transpileModule("const "+handler+"; exports.run=handleCreateBracket;",{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,sandbox);
 await sandbox.exports.run();return {calls,confirmations};
}
test("cancel replacement sends no request",async()=>{const r=await run({isAdmin:true,masterExists:true,answer:false});assert.equal(r.confirmations.length,1);assert.equal(r.calls.length,0);});
test("confirmed replacement sends explicit boolean true only",async()=>{const r=await run({isAdmin:true,masterExists:true});assert.equal(r.confirmations.length,1);assert.equal(r.calls.length,1);assert.equal(JSON.stringify(r.calls[0].payload),JSON.stringify({replace_existing_master:true}));});
test("normal creation never sends replacement intent",async()=>{for(const isAdmin of [false,true]){const r=await run({isAdmin,masterExists:false});assert.equal(r.confirmations.length,0);assert.equal(JSON.stringify(r.calls[0].payload),"{}");}});
test("ordinary user cannot send replacement via this handler",async()=>{const r=await run({isAdmin:false,masterExists:true});assert.equal(r.confirmations.length,0);assert.equal(JSON.stringify(r.calls[0].payload),"{}");});
test("disabled creation sends no request or confirmation",async()=>{const r=await run({isAdmin:true,masterExists:true,disabled:true});assert.equal(r.calls.length,0);assert.equal(r.confirmations.length,0);});
test("historical UI is read-only and public route is separate",()=>{
 const view=fs.readFileSync("src/pages/BracketPage.tsx","utf8"),router=fs.readFileSync("src/main.tsx","utf8");
 assert.ok(view.includes("access.canEdit && !readOnly"));assert.ok(view.includes("access.canManage && !readOnly"));assert.ok(view.includes("historicalRoute || bracket?.read_only === true"));assert.ok(view.includes("private draft"));assert.ok(router.includes('path="/history/bracket/:bracketId" element={<BracketPage />}'));
 assert.ok(page.includes("myBracket.is_master || (playoffsLocked && myBracket.is_done)"));
});
