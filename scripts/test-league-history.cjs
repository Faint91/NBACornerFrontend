const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
function load(file, requireHook, extra={}) {
  const output=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports={};vm.runInNewContext(output,{exports,require:requireHook,Error,...extra});return exports;
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function harness() {
  const state=[],effects=[],listeners=new Map(),calls=[],selections=[];
  let stateIndex=0,effectIndex=0,token="synthetic-session-a",deny=false,defer=null;
  const history={league:{id:"league",name:"Current league name",requires_password:false},season_code:"2025-26",rows:[1,2,2,4].map((rank,i)=>({rank,display_order:i+1,display_name:"Competitor "+i,total_points:10,full_hits:1,partial_hits:0,misses:0,bonus_finalists:0,bonus_champion:0}))};
  const methods={getLeagueHistorySeasons:async(id)=>{calls.push(["list",id]);if(defer){const wait=defer;defer=null;return wait;}if(deny)throw new Error("Membership required");return {seasons:[{season_code:"2025-26"},{season_code:"2024-25"}]};},getLeagueHistory:async(id,season)=>{calls.push(["detail",id,season]);if(deny)throw new Error("Membership required");return {...history,season_code:season};}};
  const React={useState(initial){const index=stateIndex++;if(!(index in state))state[index]=initial;return [state[index],value=>{state[index]=typeof value==="function"?value(state[index]):value;}];},useEffect(fn,deps){const index=effectIndex++;const prior=effects[index];if(!prior||deps.some((v,i)=>v!==prior.deps[i]))effects[index]={deps,fn,cleanup:prior?.cleanup,pending:true};}};
  const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  const window={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  const component=load("src/components/leagues/LeagueHistoryPanel.tsx",name=>name==="react"?React:name==="react/jsx-runtime"?jsx:name.includes("AuthContext")?{useAuth:()=>({token})}:{useLeaguesApi:()=>methods},{window}).LeagueHistoryPanel;
  function render(){stateIndex=0;effectIndex=0;const tree=component({leagueId:"league",onHistoricalChange:v=>selections.push(v)});for(const effect of effects){if(effect.pending){effect.cleanup?.();effect.cleanup=effect.fn();effect.pending=false;}}return tree;}
  function all(node){return !node||typeof node!=="object"?[]:[node,...[node.props?.children].flat(Infinity).flatMap(all)];}
  function choose(value){all(render()).find(n=>n.type==="select").props.onChange({target:{value}});render();}
  return {render,all,choose,calls,selections,history,focus:()=>listeners.get("focus")(),deny:()=>{deny=true;},token:()=>{token="synthetic-session-b";},defer:promise=>{defer=promise;}};
}
async function selected(h){h.render();await flush();h.choose("2025-26");await flush();return h.render();}
test("league history API uses league-specific safe GET routes",async()=>{
 const calls=[];const api=load("src/api/leagues.ts",()=>({useApi:()=>({get:async path=>{calls.push(path);return {};}})})).useLeaguesApi();
 await api.getLeagueHistorySeasons("league");await api.getLeagueHistory("league","2025-26");assert.deepEqual(calls,["/leagues/league/history","/leagues/league/history/2025-26"]);
});
test("historical rows render stored true-tie ranks and current name",async()=>{
 const h=harness();const nodes=h.all(await selected(h));const rows=nodes.filter(n=>n.type==="tbody")[0].props.children;
 assert.deepEqual(rows.map(row=>row.props.children[0].props.children),[1,2,2,4]);assert.equal(h.selections.at(-1),true);
 assert.ok(JSON.stringify(nodes).includes("Current league name"));assert.ok(!h.calls.some(c=>String(c).includes("global")));
});
test("returning to current clears history and restores current-view selection",async()=>{
 const h=harness();await selected(h);h.choose("");await flush();assert.equal(h.selections.at(-1),false);assert.equal(h.all(h.render()).some(n=>n.type==="tbody"),false);
});
test("focus refetch losing private membership clears all cached rows",async()=>{
 const h=harness();await selected(h);h.deny();h.focus();h.render();await flush();const nodes=h.all(h.render());assert.equal(nodes.some(n=>n.type==="tbody"),false);assert.ok(JSON.stringify(nodes).includes("Membership required"));
});
test("stale authorized response cannot restore rows after token change",async()=>{
 const h=harness();await selected(h);let release;h.defer(new Promise(resolve=>{release=resolve;}));h.focus();h.render();h.deny();h.token();h.render();await flush();release({seasons:[{season_code:"2025-26"}]});await flush();const nodes=h.all(h.render());assert.equal(nodes.some(n=>n.type==="tbody"),false);assert.ok(JSON.stringify(nodes).includes("Membership required"));
});
test("historical page mode hides current membership controls without changing their ownership checks",()=>{
 const source=fs.readFileSync("src/pages/LeagueInfoPage.tsx","utf8");assert.match(source,/selectedLeagueId && !historicalLeagueView/);assert.match(source,/onHistoricalChange=\{setHistoricalLeagueView\}/);assert.match(source,/m.user_id === currentUserId && m.is_owner/);
});
