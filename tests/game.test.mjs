import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, initialGame, distanceFor, shotPhysics } from "../lib/game.ts";

function match() {
  const g=initialGame("Rafael","a",0);
  g.players.push({name:"Friend",tokenHash:"b",score:0});
  return applyAction(g,0,{type:"start"},0);
}
function shoot(g,aim=0,power=1,id="shot-"+String(g.shotIndex).padStart(6,"0")) {
  return applyAction(g,g.shotIndex%2,{type:"shoot",aim,power,id,shotIndex:g.shotIndex},Math.max(g.readyAt,5000));
}
test("rounds give both players the same distance and stop backing up at their own 20",()=>{
  assert.deepEqual(Array.from({length:20},(_,i)=>distanceFor(i)),[10,10,20,20,30,30,40,40,50,50,60,60,70,70,80,80,80,80,80,80]);
});
test("one point for a good shot; a short or wide shot misses",()=>{
  assert.equal(shotPhysics(10,0,1,0).goal,true);
  assert.equal(shotPhysics(50,0,.05,0).reason,"TOO LOW");
  assert.equal(shotPhysics(10,55,1,0).reason,"WIDE RIGHT");
  assert.equal(shotPhysics(10,-55,1,0).reason,"WIDE LEFT");
  assert.equal(shotPhysics(10,55,1,14).goal,true);
});
test("an opponent can affect the shot by moving the hands",()=>{
  assert.equal(shotPhysics(10,0,1,0).goal,true);
  assert.equal(shotPhysics(10,0,1,14).goal,false);
});
test("only the defender can move; movement is range- and speed-limited",()=>{
  const g=match();
  assert.throws(()=>applyAction(g,0,{type:"move",hand:14,shotIndex:0},1000),/defender/);
  const moved=applyAction(g,1,{type:"move",hand:100,shotIndex:0},100);
  assert.equal(moved.hand,2.2);
  assert.equal(applyAction(g,1,{type:"move",hand:100,shotIndex:0},5000).hand,14);
  assert.throws(()=>applyAction(g,1,{type:"move",hand:NaN,shotIndex:0},5000),/invalid/);
});
test("a valid seat and correct turn are required",()=>{
  const action={type:"shoot",aim:0,power:1,id:"legit-shot",shotIndex:0};
  assert.throws(()=>applyAction(match(),-1,action,5000),/Join/);
  assert.throws(()=>applyAction(match(),1,action,5000),/opponent/);
});
test("shot and hand position lock during flight; stale moves cannot affect the next shot",()=>{
  const original=match();
  const shifted=applyAction(original,1,{type:"move",hand:14,shotIndex:0},3000);
  const after=shoot(shifted);
  assert.equal(after.shots[0].hand,14);
  assert.equal(after.players[0].score,0);
  assert.throws(()=>applyAction(after,0,{type:"move",hand:-14,shotIndex:1},5001),/finish/);
  assert.throws(()=>applyAction(after,1,{type:"move",hand:-14,shotIndex:0},9000),/turn changed/);
  assert.equal(original.shots.length,0,"actions do not mutate the prior state");
});
test("retries of an accepted shot are idempotent",()=>{
  const g=shoot(match());
  const retry=applyAction(g,0,{type:"shoot",aim:0,power:1,id:g.shots[0].id,shotIndex:0},g.readyAt);
  assert.equal(retry.shotIndex,1);
  assert.equal(retry.players[0].score,1);
  assert.equal(retry.shots.length,1);
});
test("non-finite or out-of-range controls cannot generate points",()=>{
  for(const [aim,power] of [[NaN,1],[Infinity,1],[0,NaN],[0,4],[90,1],[-90,1],[0,-1]]) {
    assert.throws(()=>shoot(match(),aim,power),/aiming controls/);
  }
});
test("a complete five-round match ends only after ten shots",()=>{
  let g=match();
  for(let i=0;i<10;i++) {
    g=shoot(g,0,i%2? .05:1);
    assert.equal(g.phase,i===9?"finished":"playing");
  }
  assert.deepEqual(g.players.map(p=>p.score),[5,0]);
});
test("sudden death gives the trailing player an equal opportunity",()=>{
  let g=match();
  for(let i=0;i<10;i++)g=shoot(g,0,.05);
  assert.equal(g.phase,"playing");
  g=shoot(g,0,1);
  assert.equal(g.phase,"playing");
  g=shoot(g,0,.05);
  assert.equal(g.phase,"finished");
  assert.equal(g.shots[10].distance,60);
  assert.equal(g.shots[11].distance,60);
});
test("ties at own 20 stay there until a whole pair resolves the match",()=>{
  let g=match();
  for(let i=0;i<20;i++)g=shoot(g,0,.05);
  assert.equal(g.phase,"playing");assert.equal(distanceFor(g.shotIndex),80);
  g=shoot(g,0,1);assert.equal(g.phase,"playing");
  g=shoot(g,0,.05);assert.equal(g.phase,"finished");
});
test("both players must request a rematch; then scores, shots and hands reset",()=>{
  let g=match();
  for(let i=0;i<10;i++)g=shoot(g,0,i%2?.05:1);
  g=applyAction(g,0,{type:"rematch"},g.readyAt);
  assert.equal(g.phase,"finished");
  g=applyAction(g,1,{type:"rematch"},g.readyAt);
  assert.equal(g.phase,"playing");assert.equal(g.match,2);
  assert.equal(g.shots.length,0);assert.equal(g.shotIndex,0);
  assert.deepEqual(g.players.map(p=>p.score),[0,0]);assert.equal(g.hand,0);
});
