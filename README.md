# Block Island

Block Island is a small, single-player Minecraft-style island game made with static HTML, CSS, and JavaScript using Three.js. It has no game server, account system, or game engine. The world is fixed and uses the supplied block textures.

## Play

Open `index.html` in a modern browser. The page loads Three.js from jsDelivr, so an internet connection is needed unless that library is cached by the browser.

- Click **Click to play** to start.
- Hold **W/A/S/D** to move one block at a time. Move the mouse to look around.
- Press **Space** to jump. Press it again within one second for a second jump.
- Aim at a block and hold the **left mouse button** to break it. Releasing early cancels the break.
- Walk close to a dropped block to collect it.
- Select an inventory slot with **1–9**, then right-click a block face to place one block. Holding right-click places repeatedly.
- Press **Escape** to pause. Press it again or choose **Resume** to continue.

You begin with an empty inventory. Break a block and collect its drop before trying to place one. Dirt breaks in under a second; stone takes about two seconds. Structures may appear after timed spawn attempts.

## Project files

- `index.html`, `style.css` — page and visual styling.
- `src/game.js` — Three.js scene, input, movement, blocks, pickups, and rendering.
- `src/logic.js` and `src/logic.mjs` — game rules and testable logic.
- `src/texture-data.js` and `assets/textures/` — supplied texture assets.
- `tests/` — automated checks for the game rules and controls.
- `BRIEF.md`, `VERIFY.md`, `PLANS.md`, `AGENTS.md` — project requirements, checks, plan, and working rules.

## Run the checks

Install Node.js, then run:

```sh
npm test
```
