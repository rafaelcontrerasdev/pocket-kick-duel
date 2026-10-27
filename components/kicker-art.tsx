import { SHIRTS, type ShirtColor } from "../lib/game";
import { kickerPose, kneeAt } from "../lib/kick";

export function Football({x=0,y=0,scale=1,rotation=-55}:{x?:number;y?:number;scale?:number;rotation?:number}) {
  return <g data-art="american-football" transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale})`}>
    <path d="M-16 0Q-9-10.5 0-10Q9-10.5 16 0Q9 10.5 0 10Q-9 10.5-16 0Z" fill="#98522f" stroke="#52351f" strokeWidth="1.5" strokeLinejoin="round"/>
    <path d="M-14 1Q0 10 14 1Q8 10 0 10Q-8 10-14 1Z" fill="#744326"/>
    <path d="M-9.5-6.5Q-7 0-9.5 6.5M9.5-6.5Q7 0 9.5 6.5" fill="none" stroke="#f1e6c9" strokeWidth="2.5"/>
    <path d="M-5-2H5M-3.5-4v4M0-4v4M3.5-4v4" stroke="#fff1d4" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M-6-7Q0-9 6-7" fill="none" stroke="#d69961" strokeWidth="1" opacity=".75"/>
  </g>;
}

// The inner edges and crossbar match the existing scoring projection exactly.
export function YellowGoal({ x }: { x: number }) {
  return <g data-art="yellow-goal" transform={`translate(${x} 0)`}>
    <ellipse cx="0" cy="109" rx="49" ry="8" fill="#142d26" opacity=".22"/>
    <path d="M0 79.5v26.5" stroke="#b17c21" strokeWidth="10" strokeLinecap="round"/>
    <path d="M-40.5 18V79.5H40.5V18" fill="none" stroke="#8a611e" strokeWidth="11" strokeLinejoin="round" strokeLinecap="round"/>
    <path d="M-40.5 18V79.5H40.5V18M0 79.5v24.5" fill="none" stroke="#f2c744" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round"/>
    <path d="M-41.5 21v55m81-55v55M-35 78.5h69" fill="none" stroke="#ffe691" strokeWidth="2" strokeLinecap="round"/>
    <rect x="-14" y="103" width="28" height="8" rx="2" fill="#d9ac36" stroke="#967126" strokeWidth="1.5"/>
  </g>;
}

export function Kicker({ x, y, elapsed, power, shirtColor, team }: {
  x: number; y: number; elapsed: number | null; power: number; shirtColor: ShirtColor; team: number;
}) {
  const shirt=SHIRTS.find(s=>s.id===shirtColor) || SHIRTS[0];
  const pose=kickerPose(elapsed,power), h=pose.hip;
  const rear=kneeAt(h,pose.plant,-1), front=kneeAt(h,pose.foot,1);
  const limb=(k:{x:number;y:number},f:{x:number;y:number})=>`M${h.x} ${h.y}L${k.x} ${k.y}L${f.x} ${f.y}`;
  return <g data-art="little-kicker" data-shirt={shirt.id} transform={`translate(${x} ${y})`} strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx={h.x} cy={h.y+46} rx="28" ry="6" fill="#142d26" opacity=".25"/>
    {pose.running && <g fill="none" stroke="#f2ecd2" strokeWidth="2" opacity=".65"><path d={`M${h.x-43} ${h.y+5}h13m-18 10h17m-9 11h12`}/></g>}
    <path d={limb(rear,pose.plant)} stroke="#243b33" strokeWidth="11" fill="none"/>
    <path d={limb(rear,pose.plant)} stroke="#dca27b" strokeWidth="7" fill="none"/>
    <path d={`M${pose.plant.x} ${pose.plant.y-6}v7l8 2`} stroke={shirt.trim} strokeWidth="9" fill="none"/>
    <path d={`M${pose.plant.x-5} ${pose.plant.y+4}h17`} stroke="#27382e" strokeWidth="7"/>
    <g transform={`rotate(${pose.lean} ${h.x} ${h.y})`}>
      <path d={`M${h.x-13} ${h.y-30}l-15 ${16+pose.arm*.35} 13 8`} stroke="#27382e" strokeWidth="10" fill="none"/>
      <path d={`M${h.x-13} ${h.y-30}l-15 ${16+pose.arm*.35} 13 8`} stroke="#e5af87" strokeWidth="6" fill="none"/>
      <path d={`M${h.x-15} ${h.y-33}Q${h.x} ${h.y-40} ${h.x+15} ${h.y-31}l4 24-7 10h-25l-6-10Z`} fill={shirt.color} stroke="#27382e" strokeWidth="2.4"/>
      <path d={`M${h.x-13} ${h.y-29}l2 7m23-7-1 7`} stroke={shirt.trim} strokeWidth="4"/>
      <text x={h.x+1} y={h.y-10} fontFamily="Arial,sans-serif" fontSize="15" textAnchor="middle" fontWeight="900" fill={shirt.trim}>{team===0?"01":"02"}</text>
      <path d={`M${h.x-12} ${h.y-1}h24v11h-12l-1-5-3 5h-10Z`} fill="#ece6ce" stroke="#27382e" strokeWidth="2"/>
      <path d={`M${h.x+13} ${h.y-26}l${12-pose.arm*.2} ${-8-pose.arm*.45} 9 5`} stroke="#27382e" strokeWidth="10" fill="none"/>
      <path d={`M${h.x+13} ${h.y-26}l${12-pose.arm*.2} ${-8-pose.arm*.45} 9 5`} stroke="#e5af87" strokeWidth="6" fill="none"/>
      <path d={`M${h.x-4} ${h.y-39}v6h10v-7`} fill="#d79b70" stroke="#27382e" strokeWidth="1.5"/>
      <g transform={`translate(${h.x} ${h.y-53}) rotate(-5)`}>
        <path d="M-17-4Q-18-20 0-21Q17-21 18-4V7Q14 20 0 20Q-15 19-17 7Z" fill="#edbb91" stroke="#27382e" strokeWidth="2.4"/>
        <path d="M-17-3Q-21-20-7-24l4 4 7-5 1 5q18-3 14 18l-6-6-4 1-4-5-13 7Z" fill="#494135" stroke="#27382e" strokeWidth="2"/>
        <ellipse cx="-16" cy="6" rx="4" ry="6" fill="#e0a67c" stroke="#27382e" strokeWidth="1.6"/>
        <ellipse cx="17" cy="5" rx="4" ry="6" fill="#e0a67c" stroke="#27382e" strokeWidth="1.6"/>
        <ellipse cx="-5" cy="0" rx="4" ry="5" fill="#fff8e7"/><ellipse cx="8" cy="-1" rx="4" ry="5" fill="#fff8e7"/>
        <circle cx="-3.5" cy=".5" r="2" fill="#263b31"/><circle cx="9.5" cy="-.5" r="2" fill="#263b31"/>
        <path d="M-9-8l7-1m8-1 7 1" fill="none" stroke="#494135" strokeWidth="2.2"/>
        <path d="M2 3l3 4H1" fill="none" stroke="#bd805b" strokeWidth="1.2"/>
        <path d="M-3 11q6 7 13-1" fill="#fff4d7" stroke="#805c43" strokeWidth="1.4"/>
      </g>
    </g>
    <path d={limb(front,pose.foot)} stroke="#243b33" strokeWidth="11" fill="none"/>
    <path d={limb(front,pose.foot)} stroke="#edbb91" strokeWidth="7" fill="none"/>
    <path d={`M${pose.foot.x} ${pose.foot.y+5}v-9`} stroke={shirt.trim} strokeWidth="8"/>
    <g transform={`translate(${pose.foot.x} ${pose.foot.y}) rotate(${elapsed!==null&&elapsed>=440?-28:8})`}>
      <path d="M-5-5H4L12 0v6H-6Z" fill="#303e32" stroke="#1e3028" strokeWidth="1.5"/>
      <path d="M-3 0h7m-6-3h5" stroke="#ecddba" strokeWidth="1.3"/>
    </g>
  </g>;
}
