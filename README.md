# Paper Football Duel

A browser-based two-player football kicking game designed by Rafael Contreras.

Play the current version: https://paper-football-duel-rafael.secretegret8.chatgpt.site

## Current prototype

Each player chooses a jersey color, joins the same room, takes five shots, and competes to score through a movable yellow goalpost. The game uses a small American football, a backward drag-and-release gesture, animated kickers, shared scoreboards, and server-authoritative multiplayer turns.

## Controls

1. Grab the football or its glowing pickup area.
2. Drag backward toward yourself.
3. Pull farther for more power; pull left or right to aim.
4. Release to start the kicker's run.

Taps, forward drags, and sideways slips do not consume a shot. Keyboard users can open the precise controls panel.

## Match rules

- Five shots per player.
- Both players shoot from the same yard line in each round.
- The starting line moves from 10 to 20, 30, 40, and 50 yards.
- A goal is worth one point.
- Ties continue into overtime with equal attempts.

## Technology

- React and TypeScript
- SVG rendering and pointer events
- Shared room API backed by D1/SQLite-compatible storage
- Deterministic server-side scoring and turn validation
- Automated tests for game rules, input gestures, animation math, and API behavior

## Project structure

- `app/page.tsx` — game screen and interaction
- `app/api/rooms/route.ts` — multiplayer API
- `lib/game.ts` — match rules, scoring, turns, and validation
- `lib/kick.ts` — drag gesture mapping and kicker animation math
- `components/kicker-art.tsx` — players, goalposts, and football artwork
- `tests/` — automated behavior tests
- `PROJECT_NOTES.md` — design decisions and playtest notes

This is an AI-assisted portfolio project. Rafael owns the game design, rules, testing, and product decisions; AI assistance was used to draft and review implementation.
