// Shared, deterministic rules. The server is the authority for online play.
export const RULES = {
  regularRounds: 5, stepYards: 10, maxDistance: 80,
  handLimit: 14, handSpeed: 22, goalHalfWidth: 7,
  crossbarHeight: 2, flightMs: 1850, pauseMs: 900,
} as const;
export const SHIRTS = [
  { id: "blue", name: "Blue", color: "#387ad2", trim: "#e7f0ff" },
  { id: "red", name: "Red", color: "#d9534e", trim: "#fff1d9" },
  { id: "white", name: "White", color: "#f7f3e6", trim: "#274c3e" },
  { id: "green", name: "Green", color: "#43865f", trim: "#eff5d8" },
  { id: "black", name: "Black", color: "#303633", trim: "#f5e7bc" },
] as const;
export type ShirtColor = typeof SHIRTS[number]["id"];
export function validShirt(value: unknown, fallback: ShirtColor = "blue"): ShirtColor {
  if (value === undefined) return fallback;
  if (!SHIRTS.some(shirt => shirt.id === value)) throw new Error("Choose one of the five shirt colors.");
  return value as ShirtColor;
}
// Optional for rooms saved before jersey selection was introduced.
export type Player = { name: string; tokenHash: string; score: number; shirtColor?: ShirtColor };
export type Shot = {
  id: string; index: number; player: number; round: number; distance: number;
  aim: number; power: number; hand: number; x: number; z: number;
  goal: boolean; reason: "GOOD!" | "WIDE LEFT" | "WIDE RIGHT" | "TOO LOW";
  at: number;
};
export type Game = {
  players: Player[]; phase: "lobby" | "playing" | "finished";
  shotIndex: number; hand: number; handAt: number; readyAt: number;
  shots: Shot[]; match: number; rematch: boolean[];
};
export type PublicGame = Omit<Game, "players"> & {
  players: { name: string; score: number; shirtColor?: ShirtColor }[];
  code: string; revision: number; me: number; serverNow: number;
};
export type Action =
  | { type: "start" }
  | { type: "move"; hand: number; shotIndex: number }
  | { type: "shoot"; aim: number; power: number; id: string; shotIndex: number }
  | { type: "rematch" };
export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
export const roundFor = (index: number) => Math.floor(index / 2) + 1;
export const distanceFor = (index: number) => Math.min(roundFor(index) * RULES.stepYards, RULES.maxDistance);
export const yardLabel = (distance: number) => distance < 50 ? `Opponent’s ${distance}` : distance === 50 ? "Midfield · 50" : `Your ${100 - distance}`;
export function initialGame(name: string, tokenHash: string, now: number, shirtColor: ShirtColor = "blue"): Game {
  return { players: [{ name, tokenHash, score: 0, shirtColor }], phase: "lobby", shotIndex: 0,
    hand: 0, handAt: now, readyAt: now, shots: [], match: 1, rematch: [false, false] };
}
export function shotPhysics(distance: number, aim: number, power: number, hand: number) {
  const yaw = aim * Math.PI / 180;
  const elevation = 23 * Math.PI / 180;
  const speed = 18 + power * 46;
  const time = distance / (speed * Math.cos(elevation) * Math.cos(yaw));
  const x = distance * Math.tan(yaw);
  const z = 0.4 + speed * Math.sin(elevation) * time - 16 * time * time;
  const reason = z < RULES.crossbarHeight ? "TOO LOW" : x < hand - RULES.goalHalfWidth ? "WIDE LEFT" : x > hand + RULES.goalHalfWidth ? "WIDE RIGHT" : "GOOD!";
  return { x, z, goal: reason === "GOOD!", reason } as const;
}
export function applyAction(game: Game, actor: number, action: Action, now: number): Game {
  const g = structuredClone(game);
  if (actor < 0 || actor >= g.players.length) throw new Error("Join this room to play.");
  if (action.type === "start") {
    if (actor !== 0) throw new Error("The host starts the match.");
    if (g.phase !== "lobby" || g.players.length !== 2) throw new Error("We need two players at the table.");
    g.phase = "playing"; g.readyAt = now; g.handAt = now; return g;
  }
  if (action.type === "rematch") {
    if (g.phase !== "finished") throw new Error("Finish this match first.");
    g.rematch[actor] = true;
    if (g.rematch.every(Boolean)) {
      g.players.forEach(p => p.score = 0);
      g.phase = "playing"; g.shotIndex = 0; g.shots = []; g.hand = 0;
      g.handAt = now; g.readyAt = now; g.match += 1; g.rematch = [false, false];
    }
    return g;
  }
  if (action.type === "shoot" && g.shots.some(s => s.id === action.id && s.player === actor)) return game;
  if (g.phase !== "playing") throw new Error("This match is not taking shots yet.");
  if (action.shotIndex !== g.shotIndex) throw new Error("The turn changed. Your table is refreshing.");
  if (now < g.readyAt) throw new Error("Let the last shot finish first.");
  const shooter = g.shotIndex % 2;
  if (action.type === "move") {
    if (actor === shooter) throw new Error("Only the defender can move the goal.");
    if (!Number.isFinite(action.hand)) throw new Error("That hand position is invalid.");
    const maxMove = Math.max(0, Math.min((now - g.handAt) / 1000, 2)) * RULES.handSpeed;
    g.hand = clamp(action.hand, Math.max(-RULES.handLimit, g.hand - maxMove), Math.min(RULES.handLimit, g.hand + maxMove));
    g.handAt = now; return g;
  }
  if (actor !== shooter) throw new Error("It is your opponent’s shot.");
  if (!Number.isFinite(action.aim) || !Number.isFinite(action.power) || action.aim < -55 || action.aim > 55 || action.power < 0.05 || action.power > 1) throw new Error("Use the aiming controls to take your shot.");
  if (typeof action.id !== "string" || !/^[a-zA-Z0-9_-]{8,80}$/.test(action.id)) throw new Error("Invalid shot. Please try again.");
  const distance = distanceFor(g.shotIndex);
  const result = shotPhysics(distance, action.aim, action.power, g.hand);
  g.shots.push({ ...result, id: action.id, index: g.shotIndex, player: actor,
    round: roundFor(g.shotIndex), distance, aim: action.aim, power: action.power,
    hand: g.hand, at: now });
  if (result.goal) g.players[actor].score += 1;
  g.shotIndex += 1;
  if (g.shotIndex >= RULES.regularRounds * 2 && g.shotIndex % 2 === 0 && g.players[0].score !== g.players[1].score) g.phase = "finished";
  g.readyAt = now + RULES.flightMs + RULES.pauseMs;
  g.hand = 0; g.handAt = g.readyAt;
  return g;
}
