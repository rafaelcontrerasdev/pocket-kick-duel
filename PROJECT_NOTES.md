# Pocket Kick Duel — design and playtest notes

Designed by Rafael Contreras. Code drafted with AI assistance; Rafael directs design, playtests, and learns the key implementation.

## Agreed direction

- A wooden table decorated as an American-football field.
- Current direction (October 22, version 6): a little football player runs up and kicks a small, laced American football toward regular yellow goalposts. Pulling back and releasing starts the run. This replaces the original hand/finger artwork and paper triangle.
- Two players on separate devices, a room code and nicknames.
- One point for a shot between the uprights and above the crossbar.
- Five shots per player; both shoot from the same line in each round.
- Each round moves ten yards farther from the goal.

## Defaults to playtest

We interpreted the starting line as the opponent's 10. Regulation uses opponent's 10, 20, 30, 40 and midfield. Tied matches continue at the shooter's own 40, 30 and 20. If still tied, stay at own 20; decide the match only after both have shot.

The defender moves the goal sideways, with a fixed opening and capped speed/range. The server freezes its position when it accepts the shot. Movement during flight is a possible later experiment, not in this version.

## How it works

- React/TypeScript displays the table and handles pointer and keyboard-accessible slider inputs.
- lib/game.ts holds deterministic scoring, progression and turn rules.
- /api/rooms stores shared state in D1. A revision check prevents concurrent writes overwriting each other. Accepted shot IDs prevent double scoring after retries.
- Each device has a random seat credential; only its hash is stored in the database. Public game state omits credentials.
- Clients poll for state; this is an early prototype, not a low-latency competitive networking system.
- A separate solo warm-up uses the same shot calculation and an automatically moving goal. It is not a substitute for online multiplayer testing.

## Rafael's first playtest (15–20 minutes)

1. Play a solo warm-up. Try a short shot, a hard shot, and shots to each side.
2. Create a room on the Mac. Open the deployed URL on the phone and join using the code.
3. Start from the host. Move the defender's goal on one device and watch the other.
4. Alternate shots. Check both devices show the same score and yard line.
5. Report: what you tried, what you expected, what actually happened; include a screenshot if helpful.

The deployed game is public, so friends can play without a Sites or ChatGPT sign-in.

## Checks

Run node --experimental-strip-types --test tests/*.test.mjs for the game-rule and API tests and node node_modules/typescript/bin/tsc --noEmit for type checking. The API tests exercise the real route against a SQLite adapter, including simultaneous joins and duplicate shot requests; they do not simulate the deployed D1 service.

Browser visuals, mobile pointer feel and an actual two-device online match still need interactive playtesting. Do not describe those checks as passed until observed.

## Later idea — not implemented

Rafael suggested letting a player choose a shooting position each round and requiring the opponent to match it. He explicitly asked to keep the original rules for now. Revisit this idea only in a future design discussion.

## Version 3 — flick and hand revision

The paper now stands on a corner with an index finger touching its upper tip, based on Rafael's reference photos. The middle finger curls against the thumb, contacts the lower edge, then extends. Support lifts just before contact.

The controller accepts both forward flicks and the original backward pull/release. Longer gestures produce more power. It reads the final pointer-up position even when the last movement arrived between frames, ignores small taps, tracks one pointer, and cancels when capture is lost. A launch guard blocks duplicate local submissions. Sliders and the Flick button remain available.

The visual flight now follows the scoring parabola: weak shots stop on the table before the goal, and the camera compresses high arcs to keep them visible. This changes input and presentation only; match rules, shot scoring, defender limits, scoreboard and hosting audience are unchanged.

Verification: 19 automated checks passed, including six control/trajectory checks and the existing game/API scenarios. Type checking and production build are required for publication. Inspected rendered SVG poses and the table. Interactive browser testing is unavailable in this environment; mouse/touch feel and two-device playback still need Rafael's playtest.

## Version 4 — tee and articulated flick

Rafael approved the version 3 shooting controls. Preserve those controls, power mapping, trajectory, scoring and turn timing. This revision replaces the supporting hand with a small blue tabletop kicking tee, shortens the goal's raised index fingers and widens the thumbs while keeping the opening and crossbar in place.

The middle finger now has three fixed-length segments rotating at the knuckles; its base stays attached to the palm. The thumb pivots clear, the finger unfolds into contact at the same 200 ms launch point, follows through and relaxes. The other fingers stay curled.

Checked seven input, trajectory and hand-motion cases, including fixed segment lengths and fingertip contact. Inspected the rendered poses and complete table. Actual browser playback still needs interactive playtesting.

## Version 5 — Rafael's portfolio audit redesign (October 22, 2026)

Rafael requested a new character/goal direction after playtesting: preserve the field style and match rules; replace hands with a goofy kicker and regular yellow posts; offer five jersey colors; move sharp-edged scoreboards outside the playing area; and replace troublesome backward mouse drags.

- Two scoreboard rails, locals left and visitors right. Narrow layouts place both panels above the field without any overlay. Scores, player names, round, distance and yard-line labels remain visible.
- All eleven main lines, labels, stripes, hash marks and shot locations use one 4.3-pixel-per-yard scale. Labels sit on the correct lines rather than below them.
- A vector kicker runs in, strikes at 440 ms and follows through. Fixed-length leg bones prevent stretching. The folded triangle and its little non-hand tee remain.
- Yellow post inner edges and crossbar match the existing scoring projection. The defender's range, movement-speed limit, shot lock and server-authoritative physics are unchanged.
- Blue, red, white, green and black shirts are selected before creating/joining. Each player's shirt is saved in shared room state and is visible on both devices. Old rooms/clients without colors fall back to blue and red.
- Aim is separate from charge: clicking/dragging on the field only aims. Hold KICK to charge up to 100%, then release. No backward pull is needed. Pointer capture permits release off the button. Keyboard Space/Enter work; Esc, blur, tab hiding and pointer cancellation safely cancel. A very short tap does not consume a shot. Manual set-power and a one-click kick remain available.
- A local HTTP preview exposed an existing dependency on secure-context-only crypto.randomUUID; shot IDs now fall back to crypto.getRandomValues. Seat credentials remain server-generated and are not affected.

Automated checks cover charge clamping, independent aim, consistent yard coordinates, goal/scoring projection, fixed-length legs, color validation, API persistence, old-client compatibility, and all original game/turn/concurrency cases. Browser playtest observations are recorded after validation; real touch feel and separate physical-device latency still need Rafael's evaluation.

### Observed version 5 checks

- 27 automated tests passed; TypeScript checking and the production build passed.
- In the browser: selected black for a warm-up; completed all five shots at 10/20/30/40/50 yards; verified final result and restart/leave controls. Mouse hold/release, Space hold/release, manual full-power shooting and aim-without-shooting all worked.
- Applied the existing rooms migration to the local preview only (its fresh database had no rooms table). No production schema change was needed.
- Two browser tabs joined the same local room as blue locals and red visitors. Both displayed the same names and colors. Moving the visitor's defender slider to 10 moved the yellow goal to the identical rendered position on both tabs. Both first-round kicks stayed at 10 yards, the server rejected neither valid turn, the visitor's red kicker appeared correctly, and the score updated after the flight.
- This was a local two-tab check, not a real two-phone/touch or deployed-network latency test.

## Version 6 — pull back and release

Rafael liked the kicker but rejected the hold-to-charge interaction. He requested a smaller, ovoid American football and a scoreboard on each side.

- The field and header now use a brown, laced American football, approximately half the previous triangle's size. The old paper tee is removed.
- The main input is a backward drag from the ball or its generous pickup area. Pull distance determines power, capped at 100%; diagonal displacement aims opposite the pull. Releasing starts the run. Duration does not change power. A visible tether and percentage follow the drag.
- Input is converted through the SVG screen transform. The pointer is captured until release; pointer-up reads the final position directly. Taps, forward drags, and sideways slips do not consume shots. Escape, blur, hidden tabs, and pointer cancellation abandon a drag. Manual slider/button controls remain available for keyboard users.
- The local kicker starts running immediately on an online release. Its animation continues when the server accepts the same shot ID; ball flight and scoring still require server acceptance. A failed request resets the local run.
- Both scoreboard rails remain beside the field at narrow widths; the previous top-row mobile layout is removed. Rules, jersey choices and defender controls are preserved.

Verification: 27 automated tests and TypeScript checking passed. Actual browser mouse drags launched a 100% straight shot and a 66% diagonal shot; a tap did not consume a shot. In a local shared room, an 88% drag/release kick was accepted, the point appeared on both clients, and the opponent received the next turn and the defender controls. The production build runs in the publication workflow. Actual phone touch feel remains for Rafael to evaluate.
