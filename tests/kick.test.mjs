import test from "node:test";
import assert from "node:assert/strict";
import { MAX_PULL, KICK_CONTACT_MS, readPull, aimAt, yardY, fieldHalfWidth, kickerPose, kneeAt } from "../lib/kick.ts";
import { SHIRTS, validShirt, shotPhysics } from "../lib/game.ts";
import { flightPoint } from "../lib/flick.ts";

test("pulling back sets power by distance, reverses aim, and caps at full power",()=>{
  const start={x:350,y:300};
  assert.equal(readPull(start,start),null);
  assert.equal(readPull(start,{x:350,y:220}),null,"forward gestures do not fire");
  assert.equal(readPull(start,{x:410,y:302}),null,"sideways slips do not fire");
  assert.equal(readPull(start,{x:354,y:306}),null,"taps do not fire");
  assert.equal(readPull(start,{x:350,y:300+MAX_PULL}).power,1);
  assert.equal(readPull(start,{x:350,y:10000}).power,1);
  assert.ok(readPull(start,{x:350,y:390}).power>readPull(start,{x:350,y:340}).power);
  const left=readPull(start,{x:320,y:390}),right=readPull(start,{x:380,y:390});
  assert.ok(left.aim>0,"pull left to shoot right");
  assert.equal(left.aim,-right.aim);
  assert.equal(left.power,right.power);
  assert.deepEqual(readPull({x:90,y:80},{x:60,y:170}),left,"pickup offset and field position do not change a gesture");
});
test("aiming is independent of power and ignores positions behind the ball",()=>{
  assert.equal(aimAt(350,94,50),0);
  assert.equal(aimAt(350,yardY(50),50),null);
  assert.equal(aimAt(350,yardY(50)+40,50),null);
  assert.ok(aimAt(420,94,50)>0);
  assert.equal(aimAt(420,94,50),-aimAt(280,94,50));
  assert.equal(aimAt(10000,94,10),55);
  assert.equal(aimAt(-10000,94,10),-55);
});
test("yard lines, ball placement and flight all use the same uniform ten-yard spacing",()=>{
  for(let yard=10;yard<=100;yard+=10){
    assert.ok(Math.abs(yardY(yard)-yardY(yard-10)-43)<1e-8);
    assert.ok(fieldHalfWidth(yardY(yard))>fieldHalfWidth(yardY(yard-10)));
    if(yard<=80){
      const p=flightPoint({...shotPhysics(yard,0,1,0),distance:yard,aim:0},0);
      assert.equal(p.y,yardY(yard));
    }
  }
});
test("yellow-post opening still agrees with the unchanged scoring physics",()=>{
  for(const distance of [10,20,30,40,50,60,70,80])
    for(const hand of [-14,0,14])
      for(const aim of [-40,-10,0,10,40])
        for(const power of [.05,.4,.7,1]){
          const result=shotPhysics(distance,aim,power,hand);
          if(!result.goal)continue;
          const p=flightPoint({...result,distance,aim},1);
          assert.ok(p.x>=350+(hand-7)*5-1e-8&&p.x<=350+(hand+7)*5+1e-8);
          assert.ok(p.y<=74+1e-8);
        }
});
test("kicker runs to the ball, contacts it at launch, and keeps both leg bones fixed",()=>{
  const ready=kickerPose(null), contact=kickerPose(KICK_CONTACT_MS);
  assert.ok(contact.hip.x>ready.hip.x+50);
  assert.ok(Math.hypot(contact.foot.x,contact.foot.y)<7);
  for(const ms of [null,0,50,100,200,330,400,440,500,640,900,1100,1500,2000]){
    const p=kickerPose(ms,.8);
    for(const [f,bend] of [[p.foot,1],[p.plant,-1]]){
      const knee=kneeAt(p.hip,f,bend);
      assert.ok(Math.abs(Math.hypot(knee.x-p.hip.x,knee.y-p.hip.y)-24)<1e-8);
      assert.ok(Math.abs(Math.hypot(knee.x-f.x,knee.y-f.y)-24)<1e-8);
    }
  }
});
test("exactly the requested five shirt colors are accepted; legacy rooms get defaults",()=>{
  assert.deepEqual(SHIRTS.map(s=>s.id),["blue","red","white","green","black"]);
  for(const s of SHIRTS)assert.equal(validShirt(s.id),s.id);
  assert.equal(validShirt(undefined),"blue");
  assert.equal(validShirt(undefined,"red"),"red");
  for(const value of [null,"pink","#fff",{},123])assert.throws(()=>validShirt(value),/five shirt colors/);
});
