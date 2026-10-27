// Exercise the actual route against SQLite, including simultaneous requests.
// This verifies API logic without claiming to verify hosted D1 or browser behavior.
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import ts from "typescript";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec(readFileSync(new URL("../drizzle/0000_neat_flatman.sql",import.meta.url),"utf8"));
const db = {
  withSession(){ return this; },
  prepare(sql){ return {bind(...args){return {
    async first(){ await Promise.resolve(); return sqlite.prepare(sql).get(...args); },
    async run(){ await Promise.resolve(); return {meta:{changes:sqlite.prepare(sql).run(...args).changes}}; }
  };}}; }
};
globalThis.__footballTestEnv = {DB:db};
let source = ts.transpileModule(readFileSync(new URL("../app/api/rooms/route.ts",import.meta.url),"utf8"),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
}).outputText;
source=source.replace('import { env } from "cloudflare:workers";',"const env = globalThis.__footballTestEnv;");
source=source.replace('"../../../lib/game"',JSON.stringify(new URL("../lib/game.ts",import.meta.url).href));
const api = await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"));
async function post(body,token) {
  const response=await api.POST(new Request("https://table.test/api/rooms",{method:"POST",
    headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:JSON.stringify(body)}));
  return {status:response.status,body:await response.json()};
}
async function get(code,token) {
  const response=await api.GET(new Request("https://table.test/api/rooms?code="+code,{headers:token?{Authorization:"Bearer "+token}:{}}));
  return {status:response.status,body:await response.json()};
}

test("two seats share state; joins, turn validation, retry and simultaneous writes are protected",async()=>{
  const created=await post({type:"create",name:"Host",shirtColor:"green"});
  assert.equal(created.status,200);
  const {code,token:host}=created.body;
  assert.equal(created.body.me,0);assert.equal(created.body.players.length,1);
  assert.equal(created.body.players[0].shirtColor,"green");
  assert.equal(created.body.players[0].tokenHash,undefined);
  const joins=await Promise.all([post({type:"join",name:"Friend",code,shirtColor:"black"}),post({type:"join",name:"Extra",code,shirtColor:"black"})]);
  assert.deepEqual(joins.map(r=>r.status).sort(),[200,400]);
  const joined=joins.find(r=>r.status===200);
  const friend=joined.body.token;
  assert.equal(joined.body.me,1);assert.equal(joined.body.players.length,2);
  assert.deepEqual(joined.body.players.map(p=>p.shirtColor),["green","black"]);
  assert.equal((await get(code)).status,400);
  assert.equal((await get(code,"wrong-seat")).status,400);
  assert.equal((await post({type:"start",code},friend)).status,400);
  assert.equal((await post({type:"start",code},host)).status,200);
  const wrong=await post({type:"shoot",code,aim:0,power:1,id:"wrong-turn",shotIndex:0},friend);
  assert.equal(wrong.status,400);
  const shot={type:"shoot",code,aim:0,power:1,id:"same-shot-retry",shotIndex:0};
  const responses=await Promise.all([post(shot,host),post(shot,host)]);
  assert.deepEqual(responses.map(r=>r.status),[200,200]);
  const a=await get(code,host),b=await get(code,friend);
  assert.equal(a.body.shotIndex,1);assert.equal(a.body.shots.length,1);
  assert.equal(a.body.players[0].score,1);
  assert.deepEqual(a.body.players,b.body.players);
  assert.deepEqual(a.body.shots,b.body.shots);
  assert.equal(a.body.revision,b.body.revision);
  assert.equal(JSON.stringify(a.body).includes("tokenHash"),false);
  assert.equal(JSON.stringify(a.body).includes(host),false);
});

test("invalid jerseys cannot be written and omitted colors preserve old-client compatibility",async()=>{
  assert.equal((await post({type:"create",name:"Host",shirtColor:"purple"})).status,400);
  const created=await post({type:"create",name:"Legacy host"});
  assert.equal(created.body.players[0].shirtColor,"blue");
  assert.equal((await post({type:"join",name:"Bad color",code:created.body.code,shirtColor:"pink"})).status,400);
  const joined=await post({type:"join",name:"Legacy visitor",code:created.body.code});
  assert.equal(joined.body.players[1].shirtColor,"red");
});
