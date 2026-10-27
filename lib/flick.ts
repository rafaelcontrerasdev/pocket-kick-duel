// Input and presentation only. Match rules and scoring stay in game.ts.
import type { Shot } from "./game";
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export const CONTACT_MS = 200;
export const PAPER_REST_ANGLE = -24;
export const PAPER_REST_SCALE = 1.15;
export type Point = { x: number; y: number };
export type FlickGesture = { aim: number; power: number; style: "forward" | "pull" };

// Both a forward flick and the original pull-and-release gesture work.
// Coordinates have already been converted into the SVG's own coordinate space.
export function readFlick(start: Point, end: Point): FlickGesture | null {
  const dx = end.x - start.x, dy = end.y - start.y;
  if (Math.abs(dy) < 12 || Math.hypot(dx, dy) < 16) return null;
  const forward = dy < 0;
  return {
    aim: clamp(Math.atan2((forward ? dx : -dx) * 4.3, Math.abs(dy) * 5) * 180 / Math.PI, -55, 55),
    power: clamp(Math.hypot(dx, dy) / 120, .05, 1),
    style: forward ? "forward" : "pull",
  };
}

const ease = (v: number) => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export type FingerPose = { root: number; bend: number; tip: number; thumb: number };

// A quick snap around the knuckles, not a stretching/morphing finger.
// The palm stays planted; the thumb releases sideways around its own joint.
export function flickPose(elapsed: number | null, pull = 0): FingerPose {
  const ready = { root: -128 + pull*8, bend: -48 - pull*15, tip: -99 - pull*3, thumb: 0 };
  const loaded = { root: -120, bend: -63, tip: -102, thumb: 0 };
  const contact = { root: -151, bend: -4, tip: -2, thumb: -18 };
  const follow = { root: -136, bend: -3, tip: -2, thumb: -18 };
  const blend = (a: FingerPose, b: FingerPose, t: number): FingerPose => ({
    root: mix(a.root,b.root,t), bend: mix(a.bend,b.bend,t),
    tip: mix(a.tip,b.tip,t), thumb: mix(a.thumb,b.thumb,t),
  });
  if (elapsed === null) return ready;
  if (elapsed < 140) return blend(ready,loaded,ease(elapsed/140));
  if (elapsed < CONTACT_MS) return blend(loaded,contact,ease((elapsed-140)/(CONTACT_MS-140)));
  if (elapsed < 290) return blend(contact,follow,ease((elapsed-CONTACT_MS)/90));
  if (elapsed < 370) return follow;
  return blend(follow,ready,ease((elapsed-370)/370));
}

export const FINGER_BONES = [30,24,16] as const;
export function fingerJoints(pose: FingerPose) {
  const points: Point[] = [{x:70,y:55}];
  let angle = 0;
  [pose.root,pose.bend,pose.tip].forEach((rotation,i)=>{
    angle += rotation;
    const last = points[points.length-1], rad = angle*Math.PI/180;
    points.push({x:last.x+Math.cos(rad)*FINGER_BONES[i],y:last.y+Math.sin(rad)*FINGER_BONES[i]});
  });
  return { points, tipAngle:angle };
}

// Compress elevation above the crossbar so long shots remain inside the camera.
// z=2 still projects exactly onto the top of the thumbs (y=74).
export function projectHeight(z: number) {
  return z <= 2 ? Math.max(0, z) * 10 : 20 + 42 * (1 - Math.exp(-(z - 2) / 8));
}

// Reconstruct the SAME parabola used to score the shot from its endpoint.
// A weak shot lands before the goal instead of gliding through it and saying LOW.
export function flightPoint(shot: Pick<Shot, "distance" | "aim" | "x" | "z">, progress: number) {
  const rise = shot.distance * Math.tan(23 * Math.PI / 180) / Math.cos(shot.aim * Math.PI / 180);
  const fall = .4 + rise - shot.z;
  const landing = fall > 0 ? (rise + Math.sqrt(rise * rise + 1.6 * fall)) / (2 * fall) : 1;
  const t = Math.min(clamp(progress, 0, 1), landing);
  const z = Math.max(0, .4 + rise * t - fall * t * t);
  const startY = 94 + shot.distance * 4.3;
  return {
    x: 350 + shot.x * 5 * t,
    y: startY + (94 - startY) * t - projectHeight(z) + 4 * (1 - t),
    groundY: startY + (94 - startY) * t + 28 * (1 - t),
    scale: PAPER_REST_SCALE - .84 * t,
    progress: t,
    landed: landing < 1 && progress >= landing,
    z,
  };
}
