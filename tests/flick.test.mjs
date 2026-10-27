import test from "node:test";
import assert from "node:assert/strict";
import { readFlick, flightPoint, projectHeight, flickPose, fingerJoints, FINGER_BONES, CONTACT_MS } from "../lib/flick.ts";
import { shotPhysics } from "../lib/game.ts";

const start = {x:350,y:300};
test("a forward flick launches; pulling in the opposite direction makes the same shot",()=>{
  const forward=readFlick(start,{x:380,y:210});
  const pull=readFlick(start,{x:320,y:390});
  assert.ok(forward.aim>0,"forward-right aims right");
  assert.equal(forward.aim,pull.aim);
  assert.equal(forward.power,pull.power);
  assert.equal(readFlick(start,{x:320,y:210}).aim,-forward.aim);
});
test("taps and sideways slips do not consume shots; power grows and stays within server limits",()=>{
  assert.equal(readFlick(start,start),null);
  assert.equal(readFlick(start,{x:355,y:297}),null);
  assert.equal(readFlick(start,{x:480,y:300}),null);
  assert.ok(readFlick(start,{x:350,y:220}).power>readFlick(start,{x:350,y:260}).power);
  const long=readFlick(start,{x:1700,y:-1200});
  assert.equal(long.power,1);
  assert.ok(Math.abs(long.aim)<=55);
});
test("all scoring shots visually cross inside the fingers and above the thumbs",()=>{
  for(const distance of [10,20,30,40,50,60,70,80])
    for(const aim of [-40,-10,0,10,40])
      for(const power of [.05,.3,.65,1])
        for(const hand of [-14,0,14]) {
          const result=shotPhysics(distance,aim,power,hand);
          if(!result.goal)continue;
          const point=flightPoint({...result,distance,aim},1);
          assert.ok(point.x>=350+(hand-7)*5-1e-8 && point.x<=350+(hand+7)*5+1e-8);
          assert.ok(point.y<=74+1e-8);
          assert.equal(point.landed,false);
          assert.ok(Math.abs(point.z-result.z)<1e-8);
        }
  assert.equal(94-projectHeight(2),74);
});
test("a weak long shot lands before the goal; a wide shot stays on its actual side",()=>{
  const short={...shotPhysics(50,0,.05,0),distance:50,aim:0};
  const point=flightPoint(short,1);
  assert.equal(point.landed,true);
  assert.ok(point.progress<1);
  assert.ok(point.groundY>94);
  assert.ok(Math.abs(point.z)<1e-8);
  const wide={...shotPhysics(10,55,1,0),distance:10,aim:55};
  assert.ok(flightPoint(wide,1).x>385);
});
test("flight begins at the held paper, remains finite, and long shots stay visible vertically",()=>{
  for(const distance of [10,30,50,80]) {
    const shot={...shotPhysics(distance,0,1,0),distance,aim:0};
    const start=flightPoint(shot,0);
    assert.equal(start.x,350);
    assert.equal(start.y,94+distance*4.3);
    for(let i=0;i<=100;i++) {
      const p=flightPoint(shot,i/100);
      assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
      assert.ok(p.y>20);
    }
  }
});
test("the middle finger bends without changing its three segment lengths",()=>{
  for(const pull of [0,.4,1]) for(const elapsed of [null,0,100,140,160,180,200,250,290,370,600,800]) {
    const {points}=fingerJoints(flickPose(elapsed,pull));
    for(let i=0;i<3;i++) assert.ok(Math.abs(Math.hypot(points[i+1].x-points[i].x,points[i+1].y-points[i].y)-FINGER_BONES[i])<1e-8);
    assert.deepEqual(points[0],{x:70,y:55},"the finger stays attached to the planted palm");
  }
});
test("the fingertip reaches the lower paper edge at impact, then follows through",()=>{
  const contact=fingerJoints(flickPose(CONTACT_MS)).points[3];
  assert.ok(contact.x>5 && contact.x<10);
  assert.ok(contact.y>22 && contact.y<26);
  const after=fingerJoints(flickPose(CONTACT_MS+90)).points[3];
  assert.ok(after.y<contact.y);
  assert.ok(flickPose(CONTACT_MS).thumb<0,"thumb pivots clear before the paper launches");
});
