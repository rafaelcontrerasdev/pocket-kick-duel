import { fingerJoints, flickPose } from "../lib/flick";
// Vector artwork stays sharp on phones; all poses use the same warm palette.
const outline = "#80563c";
const crease = "#b87e55";

export function HandPaint() {
  return <defs>
    <linearGradient id="hand-skin" x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#efc095"/><stop offset=".5" stopColor="#dda578"/><stop offset="1" stopColor="#c88a5e"/></linearGradient>
    <linearGradient id="finger-skin" x1="0" y1="0" x2="1" y2=".5"><stop stopColor="#f2c79f"/><stop offset=".58" stopColor="#e2ac80"/><stop offset="1" stopColor="#cd9266"/></linearGradient>
    <linearGradient id="nail" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f5d5b9"/><stop offset="1" stopColor="#e9bc97"/></linearGradient>
  </defs>;
}

export function Paper({ x = 0, y = 0, scale = 1, rotation = 0 }: { x?: number; y?: number; scale?: number; rotation?: number }) {
  return <g data-art="paper-football" transform={"translate(" + x + " " + y + ") rotate(" + rotation + ") scale(" + scale + ")"}>
    <path d="M-23 17 20-25 23 20Z" fill="#fff0c9" stroke="#352f24" strokeWidth="1.7" strokeLinejoin="round"/>
    <path d="M-23 17 10 8 20-25 13 17Z" fill="#d1c29a"/>
    <path d="m10 8 13 12M-17 13l29 3" fill="none" stroke="#a99973" strokeWidth="1"/>
    <path d="m-15 11 25-25" stroke="#fff9e5" strokeWidth=".8" opacity=".65"/>
  </g>;
}

// The index fingers keep the original 70 px scoring gap. Thumbs touch at
// the centre; their upper edge is the projected two-unit crossbar.
export function GoalHand({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  return <g data-art="goal-hand" transform={"translate("+x+" "+y+") scale("+(flip?-1:1)+" 1)"} strokeLinecap="round" strokeLinejoin="round">
    <path d="M-46 60-48 35Q-54 20-46 9Q-39 0-29 8L-28-10Q-28-24-20-25Q-11-25-10-14V-3Q-10 8-1 9H14Q24 9 25 16Q25 29 14 29L0 28Q-3 39-15 45L-14 60Z" fill="url(#hand-skin)" stroke={outline} strokeWidth="1.6"/>
    <path d="M-25-13Q-24-21-20-21" fill="none" stroke="#f8d6b4" strokeWidth="2.6" opacity=".7"/>
    <path d="M-25-5q6 2 12 0m-11 5q5 2 10 0" fill="none" stroke={crease} strokeWidth="1"/>
    <path d="M-46 10Q-41 5-35 9L-29 15Q-27 21-33 23L-43 20Q-50 18-46 10Z" fill="url(#finger-skin)" stroke={outline} strokeWidth="1.15"/>
    <path d="M-47 21Q-42 17-36 21L-31 26Q-29 32-35 34L-45 30Q-51 27-47 21Z" fill="url(#finger-skin)" stroke={outline} strokeWidth="1.1"/>
    <path d="M-45 33Q-41 29-36 34L-32 38Q-32 43-38 44L-46 40Q-49 36-45 33Z" fill="url(#finger-skin)" stroke={outline} strokeWidth="1.1"/>
    <path d="m-38 12 4 5m-4 7 3 4m-5 7 3 3M-11 14q6 13-8 22m-9-13q7 4 9 14m-18 9q10 4 18-1M1 13l-2 8m4-8-2 8" stroke={crease} strokeWidth="1" fill="none"/>
    <path d="M-1 13q12-2 20 1" stroke="#f1cba4" strokeWidth="2" opacity=".7" fill="none"/>
    <path d="M-48 54Q-31 59-12 53L-10 74Q-29 81-49 74Z" fill="#eee2c6" stroke={outline} strokeWidth="1.5"/>
    <path d="M-48 65q18 5 37-1" stroke="#cb7356" strokeWidth="5" fill="none"/>
    <path d="m-43 57 1 16m5-15v17m20-19 1 16" stroke="#cfbfa0" strokeWidth=".8" fill="none"/>
  </g>;
}

// A low tabletop kicking tee supports just the lower corner of the paper.
// It stays on the table after the kick; no extra hand or release animation.
export function PaperTee({ x, y, front = false }: { x: number; y: number; front?: boolean }) {
  return <g data-art={front?"tee-lip":"paper-tee"} transform={"translate("+x+" "+y+")"} strokeLinejoin="round">
    {front ? <>
      <path d="M-32 32Q-17 37-2 32V36Q-17 43-32 36Z" fill="#385764" stroke="#294750" strokeWidth="1.2"/>
      <path d="M-27 35q11 3 21 0" fill="none" stroke="#94afb0" strokeWidth="1" opacity=".7"/>
    </> : <>
      <ellipse cx="-17" cy="37" rx="23" ry="5" fill="#132e27" opacity=".18"/>
      <path d="M-32 32-25 25H-9L-2 32Q-17 38-32 32Z" fill="#69858a" stroke="#294750" strokeWidth="1.2"/>
      <path d="M-24 31V21L-17 29-10 21V31" fill="#496c77" stroke="#294750" strokeWidth="1.4"/>
      <path d="m-24 21 7 8 7-8" fill="none" stroke="#bdc9c0" strokeWidth="1.2"/>
    </>}
  </g>;
}

export function FlickHand({ x, y, elapsed = null, pull = 0 }: { x: number; y: number; elapsed?: number | null; pull?: number }) {
  const pose = flickPose(elapsed, pull);
  const {points,tipAngle} = fingerJoints(pose);
  // Round the skin around each fixed joint instead of drawing sharp elbows.
  let finger = "M"+points[0].x+" "+points[0].y;
  for(let i=1;i<3;i++){
    const p=points[i],before=points[i-1],after=points[i+1];
    const a=8/Math.hypot(before.x-p.x,before.y-p.y);
    const b=8/Math.hypot(after.x-p.x,after.y-p.y);
    finger+="L"+(p.x+(before.x-p.x)*a)+" "+(p.y+(before.y-p.y)*a);
    finger+="Q"+p.x+" "+p.y+" "+(p.x+(after.x-p.x)*b)+" "+(p.y+(after.y-p.y)*b);
  }
  finger+="L"+points[3].x+" "+points[3].y;
  const tip = points[3];
  return <g data-art="flick-hand" transform={"translate("+x+" "+y+")"} strokeLinecap="round" strokeLinejoin="round">
    <path d="M136 111 111 88Q86 87 71 69Q57 50 66 35Q76 21 94 31L119 47Q127 50 130 61L158 89Z" fill="url(#hand-skin)" stroke={outline} strokeWidth="1.7"/>
    <path d="M103 35Q108 28 115 34L127 50Q131 57 125 61Q120 63 114 55L103 43" fill="url(#finger-skin)" stroke={outline} strokeWidth="1.3"/>
    <path d="M87 27Q94 19 101 28L115 45Q119 53 112 57Q105 61 100 51L87 35" fill="url(#finger-skin)" stroke={outline} strokeWidth="1.35"/>
    <path d="M78 47Q63 38 61 28Q59 19 66 17Q73 14 80 23L94 36Q99 43 92 48Q86 52 80 43L72 33" fill="url(#finger-skin)" stroke={outline} strokeWidth="1.4"/>
    <path d="m68 22 7 8m-2-10 7 8" fill="none" stroke={crease} strokeWidth="1"/>
    <g data-art="jointed-middle-finger">
      <path d={finger} fill="none" stroke={outline} strokeWidth="17" strokeLinecap="round" strokeLinejoin="round"/>
      <path d={finger} fill="none" stroke="url(#finger-skin)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round"/>
      <g transform={"translate("+tip.x+" "+tip.y+") rotate("+tipAngle+")"}>
        <path d="M-9-4H-1Q4-4 4 0T-1 4H-9Q-11 0-9-4Z" fill="url(#nail)" stroke="#c79471" strokeWidth=".7"/>
        <path d="M-14-4v8" fill="none" stroke={crease} strokeWidth=".85"/>
      </g>
      <path d={"M"+(points[1].x-3)+" "+(points[1].y-3)+"l3 6"} fill="none" stroke={crease} strokeWidth="1"/>
    </g>
    <g transform={"rotate("+pose.thumb+" 87 66)"}>
      <path d="M94 76Q71 80 53 65L28 51Q22 46 25 41Q29 36 36 40L61 51Q81 47 90 58" fill="url(#finger-skin)" stroke={outline} strokeWidth="1.5"/>
      <path d="M28 40q5-1 11 5l-4 6q-7-3-9-7Z" fill="url(#nail)" stroke="#c79471" strokeWidth=".7"/>
      <path d="m48 47-4 7m7-4-4 7" stroke={crease} strokeWidth="1" fill="none"/>
    </g>
    <path d="M100 69q10-2 17-10m-12 18 10-4m-17-41 6 8m8-4 6 7" stroke={crease} strokeWidth="1" fill="none"/>
    <path d="m127 100 22-24 26 25-23 27Z" fill="#eee2c6" stroke={outline} strokeWidth="1.5"/>
    <path d="m137 90 26 25" stroke="#4b7591" strokeWidth="6"/>
    <path d="m131 98 24 23m4-14-17-17" stroke="#cdbd9f" strokeWidth=".8"/>
  </g>;
}

