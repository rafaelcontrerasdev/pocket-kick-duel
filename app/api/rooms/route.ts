import { env } from "cloudflare:workers";
import { applyAction, initialGame, validShirt, type Action, type Game } from "../../../lib/game";
type Row = { code: string; state: string; revision: number; expires_at: number };
const headers = { "Cache-Control": "no-store, max-age=0" };
function reply(value: unknown, status = 200) { return Response.json(value, { status, headers }); }
function database() {
  if (!env.DB) throw new Error("The table is being set up. Please try again shortly.");
  return env.DB.withSession("first-primary");
}
async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
function secret() { return crypto.randomUUID() + crypto.randomUUID(); }
function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), b => alphabet[b % alphabet.length]).join("");
}
function validCode(value: unknown) {
  const code = String(value || "").trim().toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(code)) throw new Error("Enter the six-character room code.");
  return code;
}
function nickname(value: unknown) {
  const name = String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 18);
  if (!name) throw new Error("Add a nickname first.");
  return name;
}
function view(row: Row, hash: string) {
  const game: Game = JSON.parse(row.state);
  const me = game.players.findIndex(p => p.tokenHash === hash);
  if (me < 0) throw new Error("Your seat could not be restored. Join the room again.");
  return { ...game, players: game.players.map(({ name, score, shirtColor }, i) => ({ name, score, shirtColor: validShirt(shirtColor, i ? "red" : "blue") })),
    code: row.code, revision: row.revision, me, serverNow: Date.now() };
}
async function read(code: string) {
  const row = await database().prepare("SELECT * FROM rooms WHERE code = ? AND expires_at > ?").bind(code, Date.now()).first<Row>();
  if (!row) throw new Error("That room was not found or has expired. Check the code with your friend.");
  return row;
}
async function auth(request: Request) {
  const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token || token.length > 200) throw new Error("Join the table first.");
  return digest(token);
}
export async function GET(request: Request) {
  try {
    const hash = await auth(request);
    const row = await read(validCode(new URL(request.url).searchParams.get("code")));
    return reply(view(row, hash));
  } catch (e) { return reply({ error: e instanceof Error ? e.message : "Could not refresh the table." }, 400); }
}
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("Content-Length")) > 4096) return reply({ error: "Request is too large." }, 413);
    const raw = await request.text();
    if (raw.length > 4096) return reply({ error: "Request is too large." }, 413);
    const body = JSON.parse(raw);
    if (body.type === "create") {
      const name = nickname(body.name), token = secret(), hash = await digest(token);
      for (let i = 0; i < 5; i++) {
        const now = Date.now();
        const row = { code: roomCode(), state: JSON.stringify(initialGame(name, hash, now, validShirt(body.shirtColor))), revision: 0, expires_at: now + 86400000 };
        const result = await database().prepare("INSERT OR IGNORE INTO rooms (code, state, revision, expires_at) VALUES (?, ?, ?, ?)").bind(row.code, row.state, 0, row.expires_at).run();
        if (result.meta.changes) return reply({ ...view(row, hash), token });
      }
      throw new Error("Could not open a table. Please try again.");
    }
    const code = validCode(body.code);
    const token = body.type === "join" ? secret() : null;
    const hash = token ? await digest(token) : await auth(request);
    for (let retry = 0; retry < 5; retry++) {
      const row = await read(code), game: Game = JSON.parse(row.state);
      let next: Game;
      if (body.type === "join") {
        if (game.players.length >= 2 || game.phase !== "lobby") throw new Error("This table already has two players. Create a new room to play.");
        next = structuredClone(game);
        next.players.push({ name: nickname(body.name), tokenHash: hash, score: 0, shirtColor: validShirt(body.shirtColor, "red") });
      } else {
        if (!["start", "move", "shoot", "rematch"].includes(body.type)) throw new Error("Unknown table action.");
        const actor = game.players.findIndex(p => p.tokenHash === hash);
        next = applyAction(game, actor, body as Action, Date.now());
        if (next === game) return reply(view(row, hash));
      }
      const state = JSON.stringify(next);
      const result = await database().prepare("UPDATE rooms SET state = ?, revision = revision + 1 WHERE code = ? AND revision = ?").bind(state, code, row.revision).run();
      if (result.meta.changes) return reply({ ...view({ ...row, state, revision: row.revision + 1 }, hash), ...(token ? { token } : {}) });
    }
    return reply({ error: "The table moved while you played. Please try again." }, 409);
  } catch (e) { return reply({ error: e instanceof Error ? e.message : "Something went wrong at the table." }, 400); }
}
