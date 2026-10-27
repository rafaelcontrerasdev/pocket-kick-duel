"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Copy, Flag, HelpCircle, Link2, MousePointer2, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { RULES, SHIRTS, validShirt, clamp, distanceFor, initialGame, roundFor, shotPhysics, yardLabel, type PublicGame, type Shot, type ShirtColor } from "../lib/game";

import { Football, Kicker, YellowGoal } from "../components/kicker-art";
import { PAPER_REST_SCALE, flightPoint } from "../lib/flick";
import { KICK_CONTACT_MS, readPull, fieldHalfWidth, yardY, type PullPoint } from "../lib/kick";

type Seat = { code: string; token: string };
type Mode = "home" | "practice" | "online";
type RunStart = {id:string;at:number;index:number};
const STORE = "paper-football-active-v1";
const SEATS = "paper-football-seats-v1";
const empty = { players: [{ name: "You", score: 0 }, { name: "Your rival", score: 0 }] };

function savedSeat(code: string): Seat | undefined {
  try { return JSON.parse(sessionStorage.getItem(SEATS) || "{}")[code]; } catch { return undefined; }
}
function remember(seat: Seat) {
  sessionStorage.setItem(STORE, JSON.stringify(seat));
  const seats = JSON.parse(sessionStorage.getItem(SEATS) || "{}");
  seats[seat.code] = seat;
  sessionStorage.setItem(SEATS, JSON.stringify(seats));
}
async function request(path: string, body?: object, seat?: Seat) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(path, { method: body ? "POST" : "GET", cache: "no-store",
      signal: controller.signal,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(seat ? { Authorization: "Bearer " + seat.token } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json() as PublicGame & { token?: string; error?: string };
    if (!response.ok) throw new Error(data.error || "Could not reach the table.");
    return data as PublicGame & { token?: string };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("Connection took too long. Please try again.");
    throw error;
  } finally { clearTimeout(timer); }
}

function ShirtPicker({ value, onChange, disabled = false }: { value: ShirtColor; onChange: (color: ShirtColor) => void; disabled?: boolean }) {
  return <fieldset className="shirt-picker" disabled={disabled}><legend>Your kicker’s shirt</legend><div className="shirt-options">{SHIRTS.map(shirt=><button key={shirt.id} type="button" aria-label={shirt.name+" shirt"} aria-pressed={value===shirt.id} className={value===shirt.id?"chosen":""} onClick={()=>onChange(shirt.id)}><span style={{background:shirt.color}}>{value===shirt.id&&<Check size={13} color={shirt.trim}/>}</span><small>{shirt.name}</small></button>)}</div></fieldset>;
}

function ShotScene({ shot, now, startY, power, shirtColor, team, runStart }: { shot?: Shot; now: number; startY: number; power: number; shirtColor: ShirtColor; team: number; runStart?: RunStart }) {
  const [seenAt] = useState(now);
  // Allow the receiving device to see the strike after a normal polling delay.
  // Flight still ends at the original server timestamp, so turn timing is intact.
  const startAt = runStart?.at ?? (shot ? seenAt-shot.at < 700 ? Math.max(seenAt,shot.at) : shot.at : now);
  // Start the local run on release, even while the server confirms the kick.
  // Hold at contact if needed; only an accepted shot launches the ball.
  const elapsed = shot ? Math.max(0,now-startAt) : runStart ? Math.min(KICK_CONTACT_MS-1,Math.max(0,now-startAt)) : null;
  const charge = shot?.power ?? power;
  const t = shot ? clamp((now-startAt-KICK_CONTACT_MS)/Math.max(1,shot.at+RULES.flightMs-startAt-KICK_CONTACT_MS),0,1) : 0;
  const point = shot ? flightPoint(shot,t) : {x:350,y:startY,groundY:startY+28,scale:PAPER_REST_SCALE,progress:0,landed:false};
  const trail = shot && t>0 && t<1 && !point.landed ? [0.065,0.035,0].map(back=>flightPoint(shot,Math.max(0,t-back))) : [];
  return <g className="shot-scene" pointerEvents="none">
    <ellipse cx={point.x} cy={point.groundY-16*(1-point.progress)} rx={12-8*point.progress} ry={3-1.5*point.progress} fill="#142d26" opacity=".24"/>
    {trail.length>0 && <path d={trail.map((p,i)=>(i?"L":"M")+p.x+" "+p.y).join(" ")} stroke="#fff2c9" strokeWidth="3" opacity=".42" strokeLinecap="round" fill="none"/>}
    <Football x={point.x} y={point.y} scale={point.scale*.78} rotation={-55+point.progress*220}/>
    <Kicker x={350} y={startY} elapsed={elapsed} power={charge} shirtColor={shirtColor} team={team}/>
    {elapsed!==null && elapsed>=KICK_CONTACT_MS && elapsed<KICK_CONTACT_MS+120 && <g opacity={1-(elapsed-KICK_CONTACT_MS)/120} stroke="#f5efca" strokeWidth="2" strokeLinecap="round">
      <path d={"M347 "+(startY+7)+"l-5-5m18 27 2 7m-23-14-7 1"}/>
    </g>}
  </g>;
}

function Table({ hand, distance, aim, power, shot, now, canShoot, drag, handlers, practice, defender, scoreboards, gestureHint, preparing, shirtColor, team, pullPoint, runStart }: {
  hand: number; distance: number; aim: number; power: number; shot?: Shot; now: number;
  canShoot: boolean; drag: boolean; handlers: { onPointerDown: (e: PointerEvent<SVGSVGElement>) => void; onPointerMove: (e: PointerEvent<SVGSVGElement>) => void; onPointerUp: (e: PointerEvent<SVGSVGElement>) => void; onPointerCancel: (e: PointerEvent<SVGSVGElement>) => void; onLostPointerCapture: (e: PointerEvent<SVGSVGElement>) => void };
  practice: boolean; defender: boolean; scoreboards: ReactNode[]; gestureHint: string; preparing: boolean; shirtColor: ShirtColor; team: number; pullPoint: PullPoint|null; runStart?: RunStart;
}) {
  const elapsed = shot ? now - shot.at : Infinity;
  const inShot = !!shot && elapsed < RULES.flightMs + RULES.pauseMs;
  const flight = !!shot && elapsed >= 0 && elapsed < RULES.flightMs;
  const goalX = 350 + (inShot ? shot.hand : hand) * 5;
  const startY = yardY(distance);
  const rad = aim * Math.PI / 180;
  const arrowLength = Math.min(startY - 94, 48 + power * 80);
  const arrowX = 350 + Math.tan(rad) * arrowLength * 5 / 4.3;
  const arrowY = startY - arrowLength;
  return <div className="table-wrap">
    <div className="table-caption"><span><i/> {practice ? "PRACTICE TABLE" : "THE HOME TABLE"}</span><span>{yardLabel(distance).toUpperCase()}</span></div>
    <div className="field-stage">{scoreboards[0]}<div className="field-canvas">
    <svg className={"game-table " + (canShoot ? "can-pull" : "")+(drag?" is-pulling":"")} viewBox="0 0 700 670" role="img" aria-label="Football field. Grab the small brown football, drag backward toward yourself, then release to make the kicker run and kick. Pull farther for more power; pull diagonally to aim." onContextMenu={e=>e.preventDefault()} {...handlers}>
      <defs>
        <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#c38f54"/><stop offset=".45" stopColor="#e2b574"/><stop offset="1" stopColor="#af7945"/></linearGradient>
        <linearGradient id="felt" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#2c6255"/><stop offset="1" stopColor="#214c40"/></linearGradient>
        <linearGradient id="light" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" stopOpacity=".09"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient>
        <pattern id="grain" width="95" height="180" patternUnits="userSpaceOnUse"><path d="M5 0Q25 60 6 180M28 0Q50 40 33 180M60 0Q43 100 70 180M85 0Q66 70 90 180" fill="none" stroke="#754c2b" strokeOpacity=".17" strokeWidth="2"/></pattern>
        <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="12" stdDeviation="9" floodOpacity=".24"/></filter>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto"><path d="m0 0 6 3-6 3" fill="none" stroke="#deed92" strokeWidth="1.5"/></marker>
      </defs>
      <ellipse cx="350" cy="603" rx="283" ry="34" fill="#273831" opacity=".17"/>
      <path d="M134 44H565L657 589Q658 611 636 619H66Q42 609 45 588Z" fill="#825631"/>
      <path d="M129 35Q130 26 147 25H553Q569 26 571 36L661 572Q664 594 640 601H59Q37 594 40 573Z" fill="url(#wood)" stroke="#966735" strokeWidth="3"/>
      <path d="M129 35Q130 26 147 25H553Q569 26 571 36L661 572Q664 594 640 601H59Q37 594 40 573Z" fill="url(#grain)"/>
      <path d="M157 58H543L625 562H76Z" fill="url(#felt)" stroke="#183f32" strokeWidth="6"/>
      {Array.from({length:11},(_,i)=>i).map(i => {
        const y = yardY(i*10), half = fieldHalfWidth(y), nextHalf = fieldHalfWidth(yardY(i*10+10));
        return <g key={i}>
          {i % 2 === 0 && i<10 && <path d={`M${350-half} ${y}H${350+half}L${350+nextHalf} ${y+43}H${350-nextHalf}Z`} fill="#fff" opacity=".04"/>}
          <path d={"M" + (350-half) + " " + y + "H" + (350+half)} stroke="#f1ecce" strokeOpacity=".47" strokeWidth={i === 5 ? 2.4 : 1.4}/>
          {i>0&&i<10&&<><text x={385-half} y={y} dy="6" textAnchor="middle" fill="#f1ecce" opacity=".78" fontSize="18" fontFamily="monospace" fontWeight="700" stroke="#285648" strokeWidth="5" paintOrder="stroke">{i <= 5 ? i*10 : (10-i)*10}</text>
          <text x={315+half} y={y} dy="6" textAnchor="middle" fill="#f1ecce" opacity=".78" fontSize="18" fontFamily="monospace" fontWeight="700" stroke="#285648" strokeWidth="5" paintOrder="stroke">{i <= 5 ? i*10 : (10-i)*10}</text></>}
        </g>;
      })}
      {Array.from({length:49},(_,i) => <path key={i} d={"M289 " + yardY((i+1)*2) + "h8m106 0h8"} stroke="#f1ecce" strokeOpacity=".36" strokeWidth="1.5"/>)}
      <path d={`M${350-fieldHalfWidth(94)+12} 94H${350+fieldHalfWidth(94)-12}L${350+fieldHalfWidth(524)-12} 524H${350-fieldHalfWidth(524)+12}Z`} fill="none" stroke="#f1ecce" strokeOpacity=".47" strokeWidth="2"/>
      <path d="M159 58H541L625 562H76Z" fill="url(#light)"/>
      <text x="350" y="555" textAnchor="middle" fill="#f4ecd0" opacity=".65" fontSize="13" fontFamily="monospace" letterSpacing="6">PAPER FOOTBALL CLUB</text>
      <path d="M245 108H455" stroke="#e8ecb9" strokeDasharray="3 7" strokeOpacity=".35" strokeWidth="2"/>
      <YellowGoal x={goalX}/>
      {defender && !inShot && <g><path d={"M" + (goalX-62) + " 60l-10 7 10 7m124-14 10 7-10 7"} fill="none" stroke="#d9ee8b" strokeWidth="3"/><text x={goalX} y="128" textAnchor="middle" fill="#e9f1c8" fontSize="10" fontWeight="600">MOVE YOUR GOAL</text></g>}
      {!inShot && <g pointerEvents="none">
        {canShoot && <><circle data-art="ball-grab-zone" cx="350" cy={startY} r={drag ? 28 : 32} fill="#d7ed8a" fillOpacity=".035" stroke="#d7ed8a" strokeOpacity={drag ? ".7" : ".5"} strokeDasharray={drag ? "none" : "4 5"} strokeWidth={drag ? 2 : 1}/><path d={"M350 " + (startY-16) + "L" + arrowX + " " + arrowY} fill="none" stroke="#deed92" strokeWidth="2.5" strokeDasharray="5 6" markerEnd="url(#arrow)"/>
        {pullPoint?<g data-art="pull-guide"><path d={`M350 ${startY}L${pullPoint.x} ${pullPoint.y}`} stroke="#e6edac" strokeWidth="3" strokeDasharray="5 5"/><circle cx={pullPoint.x} cy={pullPoint.y} r="12" fill="#e6edac" fillOpacity=".22" stroke="#eff5bf" strokeWidth="2"/><text x={pullPoint.x+20} y={pullPoint.y+4} fill="#f4efd1" fontFamily="monospace" fontSize="13">{Math.round(power*100)}%</text></g>:<g opacity=".65"><path d={`M350 ${startY+40}v29m-5-5 5 5 5-5`} fill="none" stroke="#e5eab6" strokeWidth="2"/><text x="350" y={startY+87} textAnchor="middle" fill="#e5eab6" fontFamily="monospace" fontSize="9" letterSpacing="1">DRAG BACK · RELEASE</text></g>}</>}
      </g>}
    <ShotScene key={inShot && shot ? shot.id : runStart?.id || "ready"} shot={inShot?shot:undefined} now={now} startY={startY} power={drag||preparing?power:0} shirtColor={shirtColor} team={team} runStart={runStart}/>
      {inShot && shot && <g>
        {!flight && <g className="shot-result" transform="translate(350 365)">
          <rect x="-115" y="-42" width="230" height="76" rx="10" fill={shot.goal ? "#dced98" : "#f7e9cc"} stroke="#193d32" strokeWidth="2"/>
          <text textAnchor="middle" y="-6" fill="#193d32" fontSize="26" fontWeight="900" fontFamily="Arial, sans-serif">{shot.reason}</text>
          <text textAnchor="middle" y="16" fill="#395949" fontSize="12" fontFamily="monospace">{shot.goal ? "+1 · BETWEEN THE POSTS" : "RESET. YOU’VE GOT THE NEXT ONE."}</text>
        </g>}
      </g>}
    </svg>
    </div>{scoreboards[1]}</div>
    <div className="table-note"><MousePointer2 size={14}/><span>{defender ? "Move your goal. Make them earn it." : preparing ? "Your kicker is on the run…" : gestureHint || (canShoot ? drag ? "Release to run and kick · "+Math.round(power*100)+"% power" : "Grab the ball. Drag back. Release to run and kick." : "A friendly rivalry, one little kick at a time.")}</span></div>
  </div>;
}

export default function Home() {
  const [mode,setMode] = useState<Mode>("home");
  const [game,setGame] = useState<PublicGame|null>(null);
  const [seat,setSeat] = useState<Seat|null>(null);
  const [name,setName] = useState("");
  const [shirtColor,setShirtColor] = useState<ShirtColor>("blue");
  const [joinCode,setJoinCode] = useState("");
  const [tab,setTab] = useState<"create"|"join">("create");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [connection,setConnection] = useState("Connected");
  const [aim,setAim] = useState(0);
  const [power,setPower] = useState(.65);
  const [drag,setDrag] = useState(false);
  const [pullPoint,setPullPoint] = useState<PullPoint|null>(null);
  const [runStart,setRunStart] = useState<RunStart|null>(null);
  const [gestureHint,setGestureHint] = useState("");
  const [now,setNow] = useState(0);
  const [rules,setRules] = useState(false);
  const [copied,setCopied] = useState("");
  const [sound,setSound] = useState(false);
  const offset = useRef(0), epoch = useRef(0), moveBusy = useRef(false);
  const handTarget = useRef<number|null>(null);
  const pointer = useRef<{id:number;start:PullPoint}|null>(null);
  const launchLock = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const audio = useRef<AudioContext|null>(null);
  const heard = useRef("");
  const stateRef = useRef(game); stateRef.current = game;

  const accept = useCallback((data: PublicGame) => {
    offset.current = data.serverNow - Date.now();
    setGame(previous => previous?.code === data.code && previous.revision > data.revision ? previous : data);
    setConnection("Connected");
  },[]);
  useEffect(() => {
    let frame = 0;
    const tick = () => { setNow(Date.now()+offset.current); frame=requestAnimationFrame(tick); };
    frame=requestAnimationFrame(tick);
    try {
      setName(localStorage.getItem("paper-football-name") || "");
      setShirtColor(validShirt(localStorage.getItem("paper-football-shirt") || undefined));
      const code = new URLSearchParams(location.search).get("room");
      if(code) {setJoinCode(code.toUpperCase().slice(0,6));setTab("join");}
      const saved = sessionStorage.getItem(STORE);
      if(saved) {
        const s: Seat = JSON.parse(saved);
        if(!code || code.toUpperCase() === s.code) {setSeat(s);setMode("online");}
      }
    } catch {}
    return () => cancelAnimationFrame(frame);
  },[]);
  useEffect(() => {
    if(mode !== "online" || !seat) return;
    let active = true; let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const data = await request("/api/rooms?code="+seat!.code,undefined,seat!);
        if(active) {accept(data);setError("");}
      } catch(e) {
        if(active) {setConnection("Reconnecting");setError(e instanceof Error ? e.message : "Connection interrupted. Retrying…");}
      } finally { if(active) timer = setTimeout(poll,document.hidden ? 1800 : 500); }
    }
    poll();
    return () => {active=false;clearTimeout(timer);};
  },[mode,seat,accept]);
  useEffect(() => {
    if(rules) dialog.current?.showModal(); else dialog.current?.close();
  },[rules]);
  useEffect(() => { handTarget.current=null;setAim(0);setDrag(false);setPullPoint(null);setGestureHint("");pointer.current=null;launchLock.current=false; },[game?.shotIndex,game?.match]);
  useEffect(() => {
    const cancel = () => { pointer.current=null;setPullPoint(null);setDrag(false); };
    const hidden = () => {if(document.hidden)cancel();};
    const escape = (e:KeyboardEvent) => {if(e.key==="Escape")cancel();};
    window.addEventListener("blur",cancel);
    document.addEventListener("visibilitychange",hidden);
    window.addEventListener("keydown",escape);
    return () => {window.removeEventListener("blur",cancel);document.removeEventListener("visibilitychange",hidden);window.removeEventListener("keydown",escape);};
  },[]);

  function beep(good: boolean) {
    if(!sound || !audio.current) return;
    const ac=audio.current;
    if(ac.state==="suspended") void ac.resume();
    const oscillator=ac.createOscillator(),gain=ac.createGain();
    oscillator.type="sine";oscillator.frequency.setValueAtTime(good?620:210,ac.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(good?980:150,ac.currentTime+.16);
    gain.gain.setValueAtTime(.08,ac.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.28);
    oscillator.connect(gain);gain.connect(ac.destination);oscillator.start();oscillator.stop(ac.currentTime+.3);
  }
  const latest=game?.shots.at(-1);
  const inShot=!!latest && now < latest.at+RULES.flightMs+RULES.pauseMs;
  const currentIndex=(inShot || game?.phase==="finished") && latest ? latest.index : game?.shotIndex || 0;
  const distance=distanceFor(currentIndex);
  const round=roundFor(currentIndex);
  const turn=(game?.shotIndex || 0)%2;
  const practice=mode==="practice";
  const canShoot=!!game && game.phase==="playing" && !inShot && !busy && (practice || game.me===turn) && connection==="Connected";
  const defender=mode==="online" && !!game && game.phase==="playing" && game.me!==turn && !inShot;
  const practiceHand=Math.sin(now/1850)*RULES.handLimit;
  const hand=practice ? practiceHand : game?.hand || 0;
  const localMotion=runStart&&runStart.index===currentIndex&&(busy||(inShot&&latest?.id===runStart.id))?runStart:undefined;
  useEffect(()=>{if(!canShoot||rules){pointer.current=null;setPullPoint(null);setDrag(false);}},[canShoot,rules]);
  useEffect(() => {
    if(latest && now >= latest.at+RULES.flightMs && heard.current!==latest.id) {
      heard.current=latest.id;beep(latest.goal);
    }
  },[latest,now,sound]);

  const act = useCallback(async (body: object, quiet=false) => {
    if(!seat) return;
    const startEpoch=epoch.current;
    if(!quiet) {setBusy(true);setError("");}
    try {
      const data=await request("/api/rooms",{...body,code:seat.code},seat);
      if(epoch.current===startEpoch) {accept(data);return data;}
    } catch(e) {if(epoch.current===startEpoch) setError(e instanceof Error?e.message:"Please try again.");}
    finally {if(!quiet && epoch.current===startEpoch)setBusy(false);}
  },[seat,accept]);
  useEffect(() => {
    if(!defender || !game) return;
    const interval=setInterval(async()=>{
      const g=stateRef.current,target=handTarget.current;
      if(!g || target===null || moveBusy.current || Math.abs(g.hand-target)<.15) return;
      moveBusy.current=true;
      await act({type:"move",hand:target,shotIndex:g.shotIndex},true);
      moveBusy.current=false;
    },180);
    return ()=>clearInterval(interval);
  },[defender,game?.shotIndex,act]);

  async function enter(type: "create"|"join") {
    if(!name.trim()) {setError("What should we call you at the table?");return;}
    setBusy(true);setError("");
    const startEpoch=++epoch.current;
    try {
      const old=type==="join" ? savedSeat(joinCode.toUpperCase()) : undefined;
      const data=old ? await request("/api/rooms?code="+old.code,undefined,old) : await request("/api/rooms",{type,name,code:joinCode,shirtColor});
      if(epoch.current!==startEpoch)return;
      const next=old || {code:data.code,token:data.token!};
      remember(next);localStorage.setItem("paper-football-name",name);localStorage.setItem("paper-football-shirt",shirtColor);
      accept(data);setSeat(next);setMode("online");
    } catch(e){setError(e instanceof Error?e.message:"Could not join. Please try again.");}
    finally {if(epoch.current===startEpoch)setBusy(false);}
  }
  function beginPractice() {
    epoch.current++;offset.current=0;setSeat(null);setError("");setConnection("Connected");
    const base=initialGame(name.trim()||"You","practice",Date.now(),shirtColor);
    base.players.push({name:"Moving target",tokenHash:"practice-target",score:0,shirtColor:"red"});
    base.phase="playing";
    setGame({...base,players:base.players.map(({name,score,shirtColor})=>({name,score,shirtColor})),code:"PRACTICE",me:0,revision:0,serverNow:Date.now()});
    setMode("practice");setAim(0);setPower(.65);setBusy(false);setRunStart(null);setPullPoint(null);launchLock.current=false;setGestureHint("");
  }
  function leave() {
    epoch.current++;setMode("home");setSeat(null);setGame(null);setBusy(false);setError("");handTarget.current=null;pointer.current=null;setPullPoint(null);setRunStart(null);setDrag(false);launchLock.current=false;
    sessionStorage.removeItem(STORE);
  }
  function shoot(nextAim=aim,nextPower=power) {
    if(!canShoot || !game || launchLock.current)return;
    launchLock.current=true;setGestureHint("");setNow(Date.now()+offset.current);
    nextAim=clamp(nextAim,-55,55);nextPower=clamp(nextPower,.05,1);
    if(sound && audio.current?.state==="suspended")void audio.current.resume();
    const id=typeof crypto.randomUUID==="function"?crypto.randomUUID():"kick-"+Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,"0")).join("");
    if(practice) {
      const at=Date.now();
      const dist=distanceFor(game.shotIndex);
      const result=shotPhysics(dist,nextAim,nextPower,practiceHand);
      const shot: Shot={...result,id,index:game.shotIndex,player:0,round:roundFor(game.shotIndex),distance:dist,aim:nextAim,power:nextPower,hand:practiceHand,at};
      const players=game.players.map((p,i)=>({...p,score:p.score+(i===0 && shot.goal?1:0)}));
      setGame({...game,players,shots:[...game.shots,shot],shotIndex:game.shotIndex+2,readyAt:at+RULES.flightMs+RULES.pauseMs,phase:game.shots.length>=4?"finished":"playing",revision:game.revision+1});
    } else {
      setRunStart({id,at:Date.now()+offset.current,index:game.shotIndex});
      void act({type:"shoot",aim:nextAim,power:nextPower,id,shotIndex:game.shotIndex}).then(data=>{
        if(!data)setRunStart(current=>current?.id===id?null:current);
      }).finally(()=>{launchLock.current=false;});
    }
  }
  function point(e:PointerEvent<SVGSVGElement>) {
    const p=e.currentTarget.createSVGPoint();
    p.x=e.clientX;p.y=e.clientY;
    const matrix=e.currentTarget.getScreenCTM();
    return matrix ? p.matrixTransform(matrix.inverse()) : {x:350,y:yardY(distance)};
  }
  const cancelPointer=(e:PointerEvent<SVGSVGElement>)=>{
    if(pointer.current?.id!==e.pointerId)return;
    pointer.current=null;setDrag(false);setPullPoint(null);setGestureHint("Kick cancelled. Grab the ball to try again.");
  };
  function updatePull(e:PointerEvent<SVGSVGElement>) {
    const active=pointer.current;if(!active)return;
    const end=point(e), dx=end.x-active.start.x, dy=end.y-active.start.y;
    const length=Math.max(1,Math.hypot(dx,dy)), visualScale=Math.min(1,150/length);
    setPullPoint({x:350+dx*visualScale,y:yardY(distance)+dy*visualScale});
    const gesture=readPull(active.start,end);
    if(gesture){setAim(gesture.aim);setPower(gesture.power);setGestureHint("");}
    else {setPower(.05);setGestureHint("Drag backward toward yourself, then release.");}
  }
  const handlers={
    onPointerDown(e:PointerEvent<SVGSVGElement>){
      if(!canShoot || pointer.current!==null || !e.isPrimary || e.button!==0)return;
      const start=point(e);
      if(Math.hypot(start.x-350,start.y-yardY(distance))>68){setGestureHint("Start on the football or its glowing circle, then drag backward.");return;}
      e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);
      pointer.current={id:e.pointerId,start};setDrag(true);setPower(.05);setPullPoint({x:350,y:yardY(distance)});setGestureHint("Drag backward toward yourself, then release.");
    },
    onPointerMove(e:PointerEvent<SVGSVGElement>){
      if(pointer.current?.id!==e.pointerId)return;
      e.preventDefault();updatePull(e);
    },
    onPointerUp(e:PointerEvent<SVGSVGElement>){
      const active=pointer.current;if(!active || active.id!==e.pointerId)return;
      e.preventDefault();
      // Use the release position, including very fast drags with no move event.
      const gesture=readPull(active.start,point(e));
      pointer.current=null;setDrag(false);setPullPoint(null);
      if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
      if(gesture){setAim(gesture.aim);setPower(gesture.power);shoot(gesture.aim,gesture.power);}
      else setGestureHint("Pull the football backward a little farther before releasing.");
    },
    onPointerCancel:cancelPointer,
    onLostPointerCapture:cancelPointer,
  };
  async function copy(kind:"code"|"link") {
    if(!game)return;
    try {
      await navigator.clipboard.writeText(kind==="code"?game.code:location.origin+"/?room="+game.code);
      setCopied(kind);setTimeout(()=>setCopied(""),1800);
    } catch {setError("Copy is unavailable here. Select the room code and copy it manually.");}
  }
  const players=game?.players || empty.players;
  const done=game?.phase==="finished" && !inShot;
  const winner=done && game ? game.players[0].score>game.players[1].score?game.players[0].name:game.players[1].name : "";
  const isLobby=mode==="online" && (!game || game.phase==="lobby");
  const status=mode==="home"?"PICK A RIVAL. PULL UP A CHAIR.":isLobby?"YOUR FRIEND HAS A SEAT WAITING.":done?"GOOD GAME. AGAIN?":inShot?"EYES ON THE PAPER.":defender?"MAKE THAT GOAL A MOVING TARGET.":"YOUR NEXT GREAT KICK STARTS HERE.";
  const shownScore = (i:number) => Math.max(0,(players[i]?.score||0)-(latest?.goal && latest.player===i && now<latest.at+RULES.flightMs ? 1 : 0));
  const teamShirt=(i:number)=>SHIRTS.find(s=>s.id===(game?.players[i]?.shirtColor || (i?"red":shirtColor))) || SHIRTS[0];
  const activeTeam=practice?0:inShot&&latest?latest.player:turn;
  const fieldScoreboards = [0,1].map(i=><section key={i} className={"field-scoreboard score-"+(i?"visitor":"home")+(game&&!done&&activeTeam===i?" on-turn":"")} aria-label={(i?"Visitors":"Locals")+" scoreboard"}>
    <p className="field-team"><i style={{background:teamShirt(i).color}}/>{i?"VISITORS":"LOCALS"}</p>
    <span className="field-player" title={players[i]?.name}>{mode==="home"?(i?"Your rival":"Your team"):practice&&i===1?"Moving target":players[i]?.name||"Open seat"}</span>
    <strong className="field-score-value" aria-live="polite" aria-atomic="true">{practice&&i===1?game?.shots.length||0:shownScore(i)}</strong>
    <span className="field-score-unit">{practice?(i?"ATTEMPTS / 5":"GOALS"):"POINTS"}</span>
    <div className="team-turn">{!game?"READY TO PLAY":done?"FULL TIME":isLobby?"IN THE LOBBY":practice&&i===1?"AUTO DEFENSE":activeTeam===i?"KICKING":"DEFENDING"}</div>
    <div className="field-yardage"><span>{round>5?"OVERTIME":"ROUND "+round}</span><div><strong>{distance}</strong><b>YD</b></div><small>{yardLabel(distance)}</small></div>
  </section>);

  return <div className="app-shell">
    <header className="topbar">
      <button className="brand" onClick={()=>mode!=="home"?setRules(true):undefined} aria-label="Paper Football Duel">
        <span className="brand-icon"><svg viewBox="-32 -32 64 64"><Football scale={1.45} rotation={-35}/></svg></span>
        <span>PAPER FOOTBALL<span className="brand-sub">THE TABLETOP DUEL</span></span>
      </button>
      <nav aria-label="Game options"><span className="edition">FIRST EDITION · 01</span><button className="icon-button" onClick={()=>{
        if(!sound){audio.current ||= new AudioContext();void audio.current.resume();}setSound(!sound);
      }} aria-label={sound?"Mute sounds":"Enable sounds"} title={sound?"Mute sounds":"Enable sounds"}>{sound?<Volume2 size={19}/>:<VolumeX size={19}/>}</button><button className="rules-button" onClick={()=>setRules(true)}><HelpCircle size={17}/><span>How to play</span></button></nav>
    </header>
    <main>
      <section className="intro"><div><p className="eyebrow"><span/> {status}</p><h1>{mode==="home"?<>Small table.<br className="mobile-break"/> Big rivalry.</>:practice?"Find your kick.":done?"Bragging rights, earned.":isLobby?"Meet me at the table.":"Make your play."}</h1><p className="intro-copy">{mode==="home"?"Little kickers. Yellow posts. One friendly score to settle.":practice?"Five shots to get a feel for aim, power, and a moving goal.":isLobby?"Share your room code, then let the friendly competition begin.":done?"A good opponent always deserves a rematch.":"Grab the football, pull back, and let your little kicker do the rest."}</p></div><div className="club-stamp" aria-hidden="true"><span>EST.</span><Flag size={23}/><span>2026</span></div></section>
      {error && <div className="error-bar" role="alert"><span>{error}</span><button onClick={()=>setError("")} aria-label="Dismiss message"><X size={16}/></button></div>}
      <div className="game-layout">
        <section className="arena" aria-label="Playing table">
          <Table hand={mode==="home"?Math.sin(now/2000)*5:hand} distance={distance} aim={aim} power={power} shot={inShot?latest:undefined} now={now} canShoot={canShoot} drag={drag} handlers={handlers} practice={practice} defender={defender} scoreboards={fieldScoreboards} gestureHint={gestureHint} preparing={busy && !!game && game.phase==="playing" && !inShot && !defender} shirtColor={teamShirt(activeTeam).id} team={activeTeam} pullPoint={pullPoint} runStart={localMotion}/>
          {mode!=="home" && <div className="arena-footer"><span className={"connection "+(connection==="Connected"?"":"offline")}><i/>{practice?"On your device":connection}</span><button onClick={leave}><ArrowLeft size={13}/> Leave table</button></div>}
        </section>
        <aside className="side-panel">
          {mode==="home" ? <div className="join-card"><p className="eyebrow">PULL UP A CHAIR</p><h2>Good games need<br/>good company.</h2><p className="muted">Bring a friend. We’ll bring the table.</p>
            <div className="segmented"><button className={tab==="create"?"selected":""} onClick={()=>{setTab("create");setError("");}}>Create a room</button><button className={tab==="join"?"selected":""} onClick={()=>{setTab("join");setError("");}}>Join a friend</button></div>
            <form onSubmit={e=>{e.preventDefault();void enter(tab);}}>
              <label htmlFor="nickname">Your nickname</label><input id="nickname" autoComplete="nickname" maxLength={18} value={name} onChange={e=>setName(e.target.value)} placeholder="What do your friends call you?"/>
              <ShirtPicker value={shirtColor} onChange={color=>{setShirtColor(color);localStorage.setItem("paper-football-shirt",color);}} disabled={busy}/>
              {tab==="join" && <><label htmlFor="room-code">Room code</label><input id="room-code" className="code-input" autoComplete="off" maxLength={6} value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,""))} placeholder="ABC123"/></>}
              <button className="primary full" disabled={busy}>{busy?"Finding your table…":tab==="create"?"Create a room":"Join the table"}<ArrowRight size={17}/></button>
            </form><div className="or-line"><span/>OR GET A FEEL FOR IT<span/></div><button className="secondary full" onClick={beginPractice}>Try a solo warm-up<ChevronRight size={17}/></button><p className="small-note">No game account. Just a nickname and a rival.</p>
          </div> : isLobby ? <div className="join-card"><p className="eyebrow">YOUR TABLE IS OPEN</p><h2>{game?.players.length===2?"The rivalry is ready.":"Save them a seat."}</h2><p className="muted">Open this game on a second device and enter this room code.</p>
            <div className="room-code"><span>ROOM CODE</span><strong>{game?.code || seat?.code || "······"}</strong><button onClick={()=>copy("code")} aria-label="Copy room code">{copied==="code"?<Check size={18}/>:<Copy size={18}/>}</button></div>
            <button className="text-link" onClick={()=>copy("link")}><Link2 size={15}/>{copied==="link"?"Link copied":"Copy invite link"}</button>
            <div className="seats">{[0,1].map(i=><div key={i}><i style={{background:teamShirt(i).color,border:"1px solid #74806d"}}/><span>{players[i]?.name || "Waiting for your friend…"}{players[i]&&<small className="seat-shirt">{i?"Visitors":"Locals"} · {teamShirt(i).name} shirt</small>}</span>{players[i]?<Check size={17}/>:<span className="waiting-dot"/>}</div>)}</div>
            {game?.me===0?<button className="primary full" disabled={game.players.length!==2||busy} onClick={()=>act({type:"start"})}>Start the duel<ArrowRight size={17}/></button>:<p className="waiting-copy">The host will start the match.</p>}
            <p className="small-note">Keep this tab to hold your seat. Rooms last 24 hours.</p>
          </div> : done ? <div className="join-card result-card"><div className="winner-flag"><Flag size={29}/></div><p className="eyebrow">{practice?"WARM-UP COMPLETE":"THE TABLE HAS SPOKEN"}</p><h2>{practice?String(game?.players[0].score)+" out of five.":winner+" takes it."}</h2><p className="muted">{practice?"You’ve found the controls. Ready to challenge a friend?":"Different shirts. Same table. Another chance."}</p>
            <button className="primary full" disabled={busy||(!practice&&!!game?.rematch[game.me])} onClick={()=>practice?beginPractice():act({type:"rematch"})}><RotateCcw size={17}/>{practice?"Another warm-up":game?.rematch[game.me]?"Waiting for your rival…":"Play a rematch"}</button>
            {!practice && game?.rematch[1-game.me] && <p className="small-note">Your opponent is ready for a rematch.</p>}
            <button className="secondary full" onClick={leave}>{practice?"Find a friend":"Back to the lobby"}<ArrowRight size={17}/></button>
          </div> : <div className="join-card controls-card"><div className="control-heading"><p className="eyebrow">{inShot?"SHOT IN PLAY":defender?"YOU’RE DEFENDING":drag?"RELEASE TO KICK":"YOU’RE KICKING"}</p>{!practice&&<span className="tiny-code">{game?.code}</span>}</div>
            <h2>{inShot?"Let it fly.":defender?<>Move the goal.<br/>Raise the stakes.</>:"Make it a good one."}</h2>
            <p className="muted">{inShot?"The yellow goal locks while the football is in flight.":defender?"Move the yellow posts left or right while your rival lines up. The opening stays the same.":"Grab the football on the field. Drag backward toward yourself to add power, then release. Your kicker starts running immediately."}</p>
            {defender ? <div className="defend-controls"><label htmlFor="hands">Move your goal<span>← &nbsp; →</span></label><input id="hands" type="range" min={-14} max={14} step={.2} value={handTarget.current??hand} onChange={e=>{handTarget.current=Number(e.target.value);setNow(Date.now()+offset.current);}}/><div className="range-labels"><span>LEFT EDGE</span><span>RIGHT EDGE</span></div><p className="small-note">Use the slider or its arrow keys. Movement is limited to the marked range. The goal locks at the kick.</p></div>
            : <div className="aim-controls"><label htmlFor="aim">Direction<span>{aim<-.5?"← "+Math.abs(Math.round(aim))+"°":aim>.5?Math.round(aim)+"° →":"Straight ahead"}</span></label><input id="aim" type="range" min="-55" max="55" step=".5" disabled={!canShoot||drag} value={aim} onChange={e=>setAim(Number(e.target.value))}/>
              <div className="power-readout"><span>KICK POWER</span><strong>{Math.round(power*100)}<small>%</small></strong></div>
              <div className="charge-meter" role="meter" aria-label="Kick power" aria-valuemin={5} aria-valuemax={100} aria-valuenow={Math.round(power*100)}><span style={{width:Math.round(power*100)+"%"}}/></div>
              <div className={"pull-instructions "+(drag?"pulling":"")}><MousePointer2 size={20}/><div><strong>{inShot?"KICK IN PLAY":busy?"RUNNING UP…":drag?"RELEASE TO RUN & KICK":"DRAG BACK & RELEASE"}</strong><p>Longer pull = more power.<br/>Pull left to aim right, and right to aim left.</p></div></div>
              <p className="small-note">Use your mouse or finger on the ball. Esc cancels a drag.</p>
              <details className="precision-controls"><summary>Keyboard / precise controls</summary><label htmlFor="power">Set power<span>{Math.round(power*100)}%</span></label><input id="power" type="range" min=".05" max="1" step=".01" disabled={!canShoot||drag} value={power} onChange={e=>setPower(Number(e.target.value))}/><button className="secondary full" disabled={!canShoot||drag} onClick={()=>shoot()}>Kick with this power<ArrowRight size={16}/></button></details>
            </div>}
          </div>}
          <div className="round-card"><div className="round-title"><Flag size={15}/><span>THE LONG GAME</span><span>5 ROUNDS</span></div><div className="round-steps">{[10,20,30,40,50].map((yard,i)=><div className={(mode!=="home"&&round===i+1?"current ":"")+(game&&round>i+1?"past":"")} key={yard}><span>{String(i+1).padStart(2,"0")}</span><b>{yard}</b><small>YD</small></div>)}</div><p>Same line for both players. Ten yards farther each round.</p>{round>5&&<p className="overtime-note">OVERTIME · {yardLabel(distance)} · Equal attempts</p>}</div>
          <div className="handwritten"><span>all you need is a little kick.</span><svg width="43" height="30" viewBox="0 0 43 30" aria-hidden="true"><path d="M40 3Q12 1 7 23m-3-9 3 10 11-4" fill="none" stroke="currentColor" strokeWidth="1.6"/></svg></div>
        </aside>
      </div>
      {game && game.shots.length>0 && <section className="shot-history"><span>THE SCORECARD</span><div>{game.shots.slice(-12).map(s=><span className={"shot-chip "+(s.goal?"scored":"missed")} key={s.id}><i className={s.player?"coral":"blue"}/>{practice?"Shot "+s.round:game.players[s.player].name} · {s.distance} yd <b>{s.goal?"+1":"×"}</b></span>)}</div></section>}
      <footer><span>A little friendly competition goes a long way.</span><span>PAPER FOOTBALL DUEL <i/> PLAYTEST EDITION</span></footer>
    </main>
    <dialog ref={dialog} onCancel={()=>setRules(false)} onClick={e=>{if(e.target===dialog.current)setRules(false);}} className="rules-dialog"><button className="dialog-close icon-button" onClick={()=>setRules(false)} aria-label="Close rules"><X size={22}/></button><p className="eyebrow">WELCOME TO THE TABLE</p><h2>Easy to learn.<br/>Fun to settle.</h2>
      <ol><li><b>Bring a friend.</b> Choose a shirt, create a room and share its six-character code. The host starts when both players arrive.</li><li><b>Pull back and kick.</b> Grab the football or its glowing circle, drag backward toward yourself, then release to start the kicker’s run. A longer pull adds power; pulling left aims right and vice versa. Esc cancels. Keyboard users can set both sliders and activate “Kick with this power”. Clear the yellow crossbar for one point.</li><li><b>Keep them guessing.</b> The defender slides the yellow goal sideways within a fixed range. The goal freezes when the server accepts the kick.</li><li><b>Back it up.</b> Both players shoot once at the opponent’s 10, 20, 30, 40, then the 50. The higher score after five shots each wins.</li><li><b>Settle the tie.</b> Continue at your own 40, 30, then 20. Stay at your own 20 until a round ends with different scores. Both players always get a shot.</li></ol>
      <p className="rules-footnote">The warm-up is solo practice with an automatically moving goal. An online duel uses your opponent’s controls. The shot rules and defender movement limits are unchanged in this redesign.</p><button className="primary full" onClick={()=>setRules(false)}>Got it. Let’s play.<ArrowRight size={17}/></button>
    </dialog>
  </div>;
}
