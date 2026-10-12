# Castaway Isle

A cozy hex-tile island builder prototype. Draft tile cards, grow the island
one hex at a time, and reach the lighthouse so a second castaway can join you.

Built with Three.js, TypeScript and Vite, using free CC0 3D models from KayKit.

## Running it

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build into dist/
```

## How to play

- **Choose a tile card.** You're dealt two cards each day. Click one (or press `1` / `2`).
- **Place it.** Valid spots glow on the water. Hovering shows a preview and what the tile
  would produce per day. Click to place; `Esc` or clicking the card again cancels.
- **The day ends** after each placement: every tile produces resources, then you get a new hand.
- **Rest a day** when you can't afford anything: the island still produces and you redraw.
- **Camera:** left-drag to orbit, right-drag to pan, scroll to zoom.

| Card | Cost | Produces |
|---|---|---|
| Meadow | 1 🪵 | 🍒 1, +1 per neighbouring forest (max +2) |
| Forest | 3 🍒 | 🪵 1, +1 for every 3 tiles in its connected forest |
| Mountain | 2 🪵 3 🍒 | 🪨 equal to the longest straight mountain range through it (max 4) |

All numbers live in `src/game/config.ts` and `src/game/cards.ts`.

## Project layout

```
src/
  game/        pure game logic, no rendering
    hex.ts       axial hex coordinates (pointy-top, matches KayKit tiles)
    config.ts    tunable numbers: caps, starting resources, lighthouse position
    cards.ts     card definitions and yield rules (cluster size, range length)
    state.ts     game state, day loop, objectives
  render/      everything Three.js
    world.ts     scene, camera, lights, post-processing, placement feedback
    water.ts     stylized water shader + distance-to-shore field for foam/shallows
    tiles.ts     tile visuals and the rocky cliff skirt around each tile
    props.ts     procedural props the packs lack: campfire, berry bushes, lighthouse
    assets.ts    model loading and the palette regrade of the KayKit atlas
    cardArt.ts   card illustrations rendered from the real tile models
    tween.ts     tiny tween runner and seeded RNG
  ui/hud.ts    DOM overlay: resources, objectives, cards, floating labels
assets/        3D model packs, served as static files
```

## Credits and licenses

Every third-party asset and library here can be used, modified and redistributed in
personal and commercial projects.

| What | By | License |
|---|---|---|
| [Medieval Hexagon Pack](https://kaylousberg.itch.io/kaykit-medieval-hexagon) (tiles, nature, props) | Kay Lousberg | CC0 1.0 (public domain); see `assets/kaykit-medieval-hexagon/LICENSE.txt` |
| [Adventurers Character Pack](https://kaylousberg.itch.io/kaykit-adventurers) (castaways) | Kay Lousberg | CC0 1.0 (public domain); see `assets/kaykit-adventurers/LICENSE.txt` |
| [three.js](https://threejs.org) | three.js authors | MIT |
| [postprocessing](https://github.com/pmndrs/postprocessing) | pmndrs | Zlib |
| [Fraunces](https://fonts.google.com/specimen/Fraunces) via Fontsource | Undercase Type | SIL Open Font License 1.1 |
| [Vite](https://vite.dev), [TypeScript](https://www.typescriptlang.org) | (build tools) | MIT, Apache-2.0 |

KayKit assets are CC0 and need no attribution, but credit is appreciated:
models by [Kay Lousberg](https://www.kaylousberg.com).
The campfire, berry bushes, lighthouse, cliff skirts, water and UI are original to this project.

## Next steps

- **Balance the economy.** Right now resources hit their caps quickly and resting is rarely needed.
- Castaways walk to tiles and work them (Cut tree / Mine rock actions), with physical stockpiles.
- Storage upgrades that raise resource caps.
- More terrain (beach, lake, farmland), weather, day/night, sound.
