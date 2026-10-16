const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
function load(file, requireHook) {
  const source = fs.readFileSync(file,"utf8");
  const output = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports={};vm.runInNewContext(output,{exports,require:requireHook,Error});return exports;
}
function api() {
  const calls=[];
  const methods=Object.fromEntries(["get","post","patch","del"].map(method=>[method,async(...args)=>{calls.push([method,...args]);return {league:{id:"league"}};}]));
  const hook=load("src/api/leagues.ts",()=>({useApi:()=>methods})).useLeaguesApi();return {hook,calls};
}
test("league API uses explicit delete confirmation, stable IDs and narrow owner routes",async()=>{
  const {hook,calls}=api();
  await hook.deleteLeague("league",true);await hook.transferOwnership("league","member");await hook.removeMember("league","member");await hook.updateLeague("league",{name:"NBA Friends"});
  assert.equal(JSON.stringify(calls),JSON.stringify([
    ["del","/leagues/league",{confirm_delete:true}],
    ["post","/leagues/league/ownership",{target_user_id:"member"}],
    ["del","/leagues/league/members/member"],
    ["patch","/leagues/league",{name:"NBA Friends"}],
  ]));
});
function ownerTree(state={},fail=false) {
  let index=0;const values=[state.name??"NBA Friends",state.private??false,state.password??"",state.target??"member",state.pending??null,false,""];
  const calls=[],messages=[];let refreshed=0;
  const React={useState:()=>{const n=index++;return [values[n],value=>{values[n]=value;if(n===6)messages.push(value);}];}};
  const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  const methods=Object.fromEntries(["updateLeague","transferOwnership","removeMember"].map(method=>[method,async(...args)=>{calls.push([method,...args]);if(fail)throw new Error("Refused");}]));
  const component=load("src/components/leagues/LeagueOwnerControls.tsx",name=>name==="react"?React:name==="react/jsx-runtime"?jsx:{useLeaguesApi:()=>methods}).LeagueOwnerControls;
  const tree=component({league:{id:"league",name:"NBA Friends",requires_password:state.existingPrivate??false},members:[{user_id:"owner",is_owner:true},{user_id:"member",is_owner:false,username:"Member"}],onChanged:async()=>{refreshed++;}});
  function all(node){return !node||typeof node!=="object"?[]:[node,...[node.props?.children].flat(Infinity).flatMap(all)];}
  return {nodes:all(tree),calls,messages,values,get refreshed(){return refreshed;}};
}
async function save(tree) { tree.nodes.find(n=>n.type==="form").props.onSubmit({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve)); }
test("owner rename preserves private password unless explicitly changed",async()=>{
  const tree=ownerTree({name:" NBA FRIENDS ",private:true,existingPrivate:true});await save(tree);
  assert.equal(JSON.stringify(tree.calls),JSON.stringify([["updateLeague","league",{name:"NBA FRIENDS"}]]));assert.equal(tree.refreshed,1);
});
test("privacy changes send only deliberate new password or public state",async()=>{
  const makePrivate=ownerTree({private:true,password:" x "});await save(makePrivate);
  assert.equal(JSON.stringify(makePrivate.calls[0]),JSON.stringify(["updateLeague","league",{name:"NBA Friends",is_private:true,password:"x"}]));assert.equal(makePrivate.values[2],"");
  const makePublic=ownerTree({existingPrivate:true});await save(makePublic);
  assert.equal(JSON.stringify(makePublic.calls[0]),JSON.stringify(["updateLeague","league",{name:"NBA Friends",is_private:false}]));
});
test("transfer and kick require confirmation and exclude owner as target",async()=>{
  for(const pending of ["transfer","remove"]){const tree=ownerTree({pending});const labels=tree.nodes.filter(n=>n.type==="option").map(n=>n.props.value);assert.deepEqual(labels,["","member"]);
    tree.nodes.find(n=>n.type==="button"&&Array.isArray(n.props.children)&&n.props.children[0]==="Confirm ").props.onClick();await new Promise(resolve=>setImmediate(resolve));
    assert.equal(JSON.stringify(tree.calls),JSON.stringify([[pending==="transfer"?"transferOwnership":"removeMember","league","member"]]));assert.equal(tree.refreshed,1);
  }
});
test("owner action failure surfaces server error without success refresh",async()=>{
  const tree=ownerTree({},true);await save(tree);assert.equal(tree.refreshed,0);assert.equal(tree.messages.at(-1),"Refused");
});
test("page owner controls require actual ownership and deletion follows confirmation",()=>{
  const source=fs.readFileSync("src/pages/LeagueInfoPage.tsx","utf8");
  assert.match(source,/iAmOwner && myLeagues.find/);assert.match(source,/m.user_id === currentUserId && m.is_owner/);assert.match(source,/deleteLeague\(selectedLeagueId, true\)/);assert.ok(source.includes("confirmDeleteOpen"));
});
