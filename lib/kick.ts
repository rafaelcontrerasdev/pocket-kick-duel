// Presentation and input only. Scoring/turns remain server-authoritative in game.ts.
import { clamp } from "./game.ts";

export const KICK_CONTACT_MS = 440;
export const MAX_PULL = 120;
export type PullPoint = {x:number;y:number};
// Coordinates are in the field's SVG space, independent of display size.
// Pull opposite the intended shot; power depends on distance, never duration.
export function readPull(start: PullPoint, end: PullPoint) {
  const dx=end.x-start.x, dy=end.y-start.y;
  if(dy<10 || Math.hypot(dx,dy)<16)return null;
  return {
    aim:clamp(Math.atan2(-dx*4.3,dy*5)*180/Math.PI,-55,55),
    power:clamp(Math.hypot(dx,dy)/MAX_PULL,.05,1),
  };
}
export const FIELD = { center: 350, goalY: 94, yardScale: 4.3 } as const;
export const yardY = (yards: number) => FIELD.goalY + yards * FIELD.yardScale;
export const fieldHalfWidth = (y: number) => 193 + (y - 58) * 81 / 504;
export function aimAt(x: number, y: number, distance: number) {
  const dy = yardY(distance) - y;
  if (dy < 12) return null;
  return clamp(Math.atan2((x - FIELD.center) * FIELD.yardScale, dy * 5) * 180 / Math.PI, -55, 55);
}
const ease = (t: number) => { const v = clamp(t, 0, 1); return v * v * (3 - 2 * v); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function kickerPose(elapsed: number | null, power = 0) {
  const run = elapsed === null ? 0 : ease(elapsed / KICK_CONTACT_MS);
  const follow = elapsed === null ? 0 : ease((elapsed - KICK_CONTACT_MS) / 200);
  const reset = elapsed === null ? 0 : ease((elapsed - 900) / 600);
  const travel = run * (1 - reset);
  const hip = { x: lerp(-92, -30, travel), y: lerp(63, 38, travel) };
  const stride = elapsed !== null && elapsed < KICK_CONTACT_MS ? Math.sin(elapsed / 55) * (1 - run) * 14 : 0;
  const lean = elapsed === null ? -power * 5 : lerp(-8, 12, follow) * (1 - reset);
  const strike = elapsed === null ? 0 : ease((elapsed - 330) / 110);
  const contactFoot = { x: -4 + follow * 18, y: 4 - follow * 16 };
  const restFoot = { x: hip.x + 10 + stride, y: hip.y + 41 };
  const kick = strike * (1 - reset);
  const rawFoot={ x: lerp(restFoot.x, contactFoot.x, kick), y: lerp(restFoot.y, contactFoot.y, kick) };
  const reach=Math.hypot(rawFoot.x-hip.x,rawFoot.y-hip.y);
  const foot=reach>47?{x:hip.x+(rawFoot.x-hip.x)*47/reach,y:hip.y+(rawFoot.y-hip.y)*47/reach}:rawFoot;
  return {
    hip, lean,
    plant: { x: hip.x - 6 - stride, y: hip.y + 43 },
    foot,
    arm: elapsed === null ? power * 8 : stride + follow * 13,
    running: elapsed !== null && elapsed < KICK_CONTACT_MS,
  };
}
// Two fixed-length bones; keeps the legs attached instead of stretching them.
export function kneeAt(hip: {x:number;y:number}, foot: {x:number;y:number}, bend = 1) {
  const dx=foot.x-hip.x, dy=foot.y-hip.y, d=Math.max(.001,Math.hypot(dx,dy));
  const length=24, offset=Math.sqrt(Math.max(0,length*length-Math.min(d,48)**2/4));
  return {x:(hip.x+foot.x)/2+dy/d*offset*bend,y:(hip.y+foot.y)/2-dx/d*offset*bend};
}
