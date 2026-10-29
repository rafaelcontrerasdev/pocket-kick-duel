# Pocket Kick Duel

A browser-based two-player American-football kicking game designed by Rafael Contreras.

**[Play Pocket Kick Duel](https://pocket-kick-duel.secretegret8.chatgpt.site)**

## Overview

Each player chooses a jersey color, joins the same room, and takes five shots. The kicker runs toward a small American football while the opposing player moves the yellow goalposts within a limited range.

Both players shoot from the same yard line in each round, progressing from 10 to 50 yards. A successful kick is worth one point, and tied matches continue into equal-attempt overtime.

## Controls

1. Grab the football or its glowing pickup area.
2. Drag backward toward yourself.
3. Pull farther for more power; pull diagonally to aim.
4. Release to start the kicker's run.

Taps, forward drags, and short sideways movements do not consume a shot. Keyboard users can use the precise direction and power controls.

## Technology

- React and TypeScript
- SVG graphics and pointer events
- REST-style room API
- D1/SQLite-compatible persistent storage
- Server-authoritative scoring and turn validation
- Automated tests for game rules, gestures, animation math, and API behavior

## Project structure

- `app/page.tsx` — primary game interface and interactions
- `app/api/rooms/route.ts` — multiplayer room API
- `lib/game.ts` — match rules, scoring, and turn validation
- `lib/kick.ts` — drag gesture mapping and kicker animation math
- `components/kicker-art.tsx` — kicker, goalpost, and football artwork
- `tests/` — automated behavior tests
- `PROJECT_NOTES.md` — design decisions and playtest history

## Playtesting

The game was tested in solo practice and in online matches with friends. The public link was also verified in a signed-out browser without requiring a ChatGPT login.

## Development

Install dependencies and start the development server:

```bash
pnpm install
pnpm dev
```

Run the automated tests:

```bash
node --experimental-strip-types --test tests/*.test.mjs
```

## Project ownership

This is an AI-assisted portfolio project. Rafael defined the concept and rules, directed the redesigns, tested the game with players, identified control and presentation problems, chose the final behavior, and reviewed the implementation. AI assistance was used to draft and revise portions of the code.
