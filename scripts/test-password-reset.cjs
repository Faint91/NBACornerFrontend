const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
function load(file, hook, extra = {}) {
 const output = ts.transpileModule(fs.readFileSync(file,"utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={}; vm.runInNewContext(output,{exports,require:hook,Error,...extra});return exports;
}
const policy=load("src/auth/identityPolicy.ts",()=>{});
const secret="a".repeat(43);
function form({completing=true,password=" exact password ",confirm=password,status=200}={}) {
 const states=[completing?{present:true,token:secret}:undefined," User@nba-corner.example ",password,confirm,false,false,null];let index=0;
 const calls=[],clears=[];const react={useState:value=>{const i=index++;if(!(i in states))states[i]=typeof value==="function"?value():value;return[states[i],v=>{states[i]=v}];}};
 const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
 const component=load("src/pages/ResetPasswordPage.tsx",name=>name==="react"?react:name==="react/jsx-runtime"?jsx:name.includes("react-router")?{Link:"a"}:name.includes("identityPolicy")?policy:name.includes("resetLink")?{resetLink:()=>states[0],clearResetLink:()=>clears.push("memory")}:name.includes("AuthContext")?{useAuth:()=>({logout:()=>clears.push("auth")})}:{apiPost:async(path,body)=>{calls.push({path,body});if(status!==200)throw Error("private transport diagnostics");}}).ResetPasswordPage;
 function all(node){return !node||typeof node!=="object"?[]:[node,...[node.props?.children].flat(Infinity).flatMap(all)];}
 const tree=component();return{states,calls,clears,submit:()=>all(tree).find(n=>n.type==="form").props.onSubmit({preventDefault(){}})};
}
test("request displays generic success and keeps identity only in component state",async()=>{const f=form({completing:false});await f.submit();assert.equal(f.calls[0].body.email,"User@nba-corner.example");assert.equal(f.states[5],true);assert.equal(f.clears.length,0);});
test("completion submits exact long Unicode password, clears auth and requires login",async()=>{for(const password of [" exact password ","😀".repeat(128),"a".repeat(73)," ".repeat(8)]){const f=form({password});await f.submit();assert.equal(f.calls[0].body.new_password,password);assert.equal(f.calls[0].body.token,secret);assert.deepEqual(f.clears,["memory","auth"]);assert.equal(f.states[2],"");assert.equal(f.states[3],"");assert.equal(f.states[5],true);}});
test("mismatch and policy boundaries prevent requests",async()=>{for(const options of [{password:"short"},{password:"😀".repeat(129)},{password:" abcdefgh ",confirm:"abcdefgh"}]){const f=form(options);await f.submit();assert.equal(f.calls.length,0);assert.ok(f.states[6]);}});
test("invalid/expired/used/backend failures never expose diagnostics or clear auth",async()=>{for(const status of [400,401,500,503]){const f=form({status});await f.submit();assert.match(f.states[6],/Invalid or expired reset link/);assert.doesNotMatch(f.states[6],/private/);assert.equal(f.clears.length,0);}});
test("pre-analytics bootstrap removes all token parameters, preserves route and uses memory only",()=>{
 const html=fs.readFileSync("index.html","utf8");const bootstrap=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];assert.ok(html.indexOf(bootstrap)<html.indexOf("googletagmanager"));
 for(const query of ["?token="+secret,"?token=one&token=two&other=ok"]){let replacement;const window={location:{href:"https://example.test/reset-password"+query},history:{state:{},replaceState:(state,title,url)=>replacement=url}};
 vm.runInNewContext(bootstrap,{window,URL});assert.doesNotMatch(replacement,/token/);const cached=load("src/auth/resetLink.ts",()=>{}, {window});assert.equal(window.__ncResetLink,undefined);assert.equal(cached.resetLink().present,true);cached.clearResetLink();assert.equal(cached.resetLink(),undefined);}
 const page=fs.readFileSync("src/pages/ResetPasswordPage.tsx","utf8");assert.doesNotMatch(page,/localStorage|sessionStorage|trackEvent|console\./);
});
test("authenticated 401 invokes normal logout for all API methods",async()=>{
 let logout=0;const source=fs.readFileSync("src/api/client.ts","utf8").replaceAll("import.meta.env.VITE_API_URL",JSON.stringify("http://synthetic.invalid"));
 const out=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;const exports={};vm.runInNewContext(out,{exports,require:()=>({useAuth:()=>({token:"synthetic",logout:()=>logout++})}),fetch:async()=>({ok:false,status:401,json:async()=>({error:"Unauthorized"})})});
 for(const method of ["get","post","patch","del"])await assert.rejects(exports.useApi()[method]("/auth/test-me"));assert.equal(logout,4);
});
