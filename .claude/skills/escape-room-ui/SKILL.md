---
name: escape-room-ui
description: Build and polish the top-down escape-room games at /learn/escape-room (RoomMap engine). Use whenever the task touches escape-room layout, decor props, floor textures/tiles, machine placement, collision, doors, ceiling fixtures (cables/bunting/lanterns), fog of war, touch controls, or scene theming. Covers the data model in src/lib/escape-rooms.ts and the renderer in EscapeRoomPlayer.tsx, plus the non-obvious gotchas (z-index layering, % vs px alignment, spawn-trap collision, cultural accuracy of themed art). Follows frontend-design (bright kids theme).
---

# Escape Room UI

Top-down, walk-around escape rooms under `/learn/escape-room/[slug]`. A child moves an emoji avatar around a grid of rooms, walks up to "machines" (puzzle stations), solves them, and leaves through a themed door. Load `frontend-design` alongside this — the modals/cards use the bright kids theme.

## Architecture (one engine)

There is **one** play engine: **`RoomMap`** (top-down, free movement). The old side-on `RoomScene` was deleted — do not resurrect it. Every room therefore **must** have a `layout` (the type makes `layout` required).

Key files:
- **`src/lib/escape-rooms.ts`** — all room DATA + the types (`EscapeRoom`, `RoomLayout`, `GridCell`, `RoomDecor`, puzzles). `ESCAPE_ROOMS` is the source of truth.
- **`src/lib/escape-geometry.ts`** — pure geometry: `buildGeometry(layout, area, {wall, doorFrac})` → floor rects + collision walls (with doorway gaps) + spawn; `moveWithCollision(...)`; `roomAt`, `centerOf`. No React here.
- **`src/lib/escape-session.ts`** + `src/app/api/learn/escape/*` — co-op multiplayer state.
- **`src/app/learn/escape-room/[slug]/EscapeRoomPlayer.tsx`** — the entire renderer (RoomMap, puzzle components, PROP_ART/THEMED_ART, floor textures, exit doors). Large file; use grep.
- **`src/app/learn/escape-room/page.tsx`** — the room-picker hub.

World units: the map is `layout.cols * 100 × layout.rows * 100` (`MAP_CELL = 100`). Positions in geometry are these world units; positions in `RoomDecor`/`mx`/`my` are **0–1 fractions of a room**.

## Data model (edit rooms here)

```ts
RoomLayout = { cols, rows, cells: GridCell[], doors: [id,id][], spawn, exit, carry?, notes?, decor? }

GridCell = {
  id, label, gx, gy, gw?=1, gh?=1,
  floor?,        // per-room Tailwind gradient override (e.g. green garden). Default = room.wall
  floorKind?,    // per-room floor-texture key (else room.floorKind), e.g. "metal","grass","water"
  stationId?,    // this room hosts that station's machine
  mx?=0.5, my?=0.5,  // where the machine stands, 0–1 of the room (so it's not always centred)
  role?, requires?, requiresAll?,   // gating
}

RoomDecor = {
  room,          // cell id
  art,           // key into PROP_ART
  x, y,          // 0–1 position in the room
  scale?=1, flip?,
  w?, h?,        // present → STRETCHED run (cable/bunting/pipe), sized as fractions of the room
  ceiling?,      // hang above the player (no collision); stretched runs are ceiling by default
  flat?,         // flat ground detail (grass/rangoli/rug): under the player, NO collision
}
```

`doors` are pairs of connected cell ids; a doorway gap opens in their shared wall (default `doorFrac` ≈ 0.6 in RoomMap's `buildGeometry` call). Any shared wall NOT listed in `doors` is solid — that's the intended maze routing. To connect two adjacent rooms, add their id pair to `doors`.

## Rendering & z-index (memorise this stack)

Everything in the map container is absolutely positioned; separation is by z-index, and **fog (z-25) hides every room except the one you're in**:

| z | layer |
|---|---|
| 0 | floor gradient tile, floor texture, per-plate tile grid |
| 10 | floor decor props; ceiling props when NOT in the current room (so fog hides them) |
| 20 | machines, notes, loose items, exit door |
| 25 | **fog** (opaque dark over non-current rooms) |
| 30 | walls |
| 40 | the player ("You") |
| 45 | ceiling props (cables/bunting/lanterns) **only in the current room** |
| 50 | action button, D-pad, transient flash toast |
| 55 | room-name label (above everything so props never cover the title) |

**Ceiling rule (important):** a ceiling fixture is z-45 (above the player) *only when `d.room === curRoom`*, else z-10. A flat high z would punch through the fog into dark rooms. Never give ceiling props a static z > 25.

Constants: `CHAR_R = 11` (player radius), `MAP_SPEED = 150`, `REACH = 58` (interaction range), `POINTS_FIRST_TRY/WITH_HELP = 10/6`.

## Decor props

**Two art dictionaries, different viewBoxes — don't mix:**
- `PROP_ART` — `viewBox 0 0 40 40`, rendered via `<Prop art=…>`. Small props, decor, carriables, doors.
- `THEMED_ART` — `viewBox 0 0 48 48`, rendered via `<ThemedDevice>` for station machines (mapped by `STATION_DEVICE["<slug>:<stationId>"]`).

**To add a prop:** add an SVG entry to `PROP_ART` (draw in the 40×40 box, base of the object near y≈32), then reference its key from a `decor` entry in `escape-rooms.ts`. Base render size is `h-12 w-12 sm:h-14 sm:w-14`; tune per-item with `scale`. Give props a contact `drop-shadow`.

**Prop modes:**
- **Floor prop** (default) — under the player (z-10), gets a small collision box.
- **`ceiling: true`** — hangs above the player in-room, no collision (lanterns, signs).
- **`flat: true`** — flat ground detail under the player, no collision (grass, rangoli, rugs, puddles).
- **`w` + `h`** — a **stretched run** drawn with `preserveAspectRatio="none"`; for line art use `vectorEffect="non-scaling-stroke"` so stroke width stays crisp when stretched (cables, bunting, pipes). Stretched = ceiling + no collision automatically.

Keep props off doorways and off the machine. Placement is fraction-based so it survives responsive scaling.

## Machines

Rendered from cells with a `stationId`. Position comes from **`machineAt(cell)`** = the cell's `mx`/`my` (default centre). Set `mx`/`my` so machines aren't all dead-centre. `machineAt` feeds the render, the proximity hit-target, AND the carry-charge anchor — never hand-roll `centerOf` for a machine. Machines are **walk-through** (not in collision), so off-centre placement never walls the player off.

## Collision

- Player is an axis-aligned box of half-size `CHAR_R = 11` (chosen to sit close to walls without the sprite clipping through).
- Solid decor (not ceiling/flat/stretched) gets a **small base box** (`hw = 5*scale`, `hh = 4*scale`) — much smaller than the sprite, so the ~11px radius doesn't create a big stand-off. Boxes are merged with `geo.walls` into a `wallsRef` the movement loop reads.
- **Spawn guard (do not remove):** the collision builder skips any prop box that would contain the spawn point grown by `CHAR_R`. Without it, a prop near spawn traps the avatar on frame 1 and it can't move at all.
- Doorway width is `doorFrac` in the `buildGeometry` call; widen it if doors feel catchy.

## Floor textures & tiles

Floors compose (all z-0):
1. **Colour** — `bg-gradient-to-br ${cell.floor ?? room.wall}`. Note the inversion: in RoomMap `room.wall` is the **floor tile** gradient and `room.floor` is the **void/between-rooms** gradient. Override a single room's floor with `cell.floor` (green Gardens), or flow a whole scene by having each room's gradient END on its neighbour's START colour.
2. **Texture** — `FLOOR_TEXTURE[cell.floorKind ?? room.floorKind]`: a **continuous** repeating CSS/SVG background (grid / plank lines / grout / glowing panel grid + `noiseBg(...)` for grain). This is the default — one background per room, NOT a grid of bordered divs.
3. **Discrete plate grid** — kept ONLY for `metal` (tread plate) in `FLOOR_GRID`, a grid of plate `<div>`s with **seeded** randomness (`seededRand` = FNV-1a of `cellId:row:col`, so plates don't flicker) and worn / missing plates. Its seams are **hairlines** (`.1` alpha, no inner vignette).

**The "box around the note" lesson (bit us hard):** a grid of bordered tile `<div>`s — especially with an inner vignette — **frames any small object sitting on a tile** (a machine is big enough to hide its tile; the note isn't). Rules to avoid it:
- Prefer a **continuous background pattern** (`FLOOR_TEXTURE`) over a per-tile div grid.
- If you use lines/grids, keep cells **finer than a sprite** (~≤26px) so lines cross THROUGH an object, not around it, and use **directional** (1-axis) patterns where possible (planks) — you need both axes to frame.
- **Never** put a hard border + inner shadow on floor tiles; seams are faint hairlines at most.

**Alignment corollary:** the reason a per-plate diamond used to slice at seams was the fixed-px background under a fractional div grid. Continuous patterns don't have this problem. For the surviving `metal` grid, the motif is sized in **%** per plate (`DIAMOND_TILE` at `33.333%` = 3×3 whole diamonds), not px.

Tailwind gradient classes written as string literals in `escape-rooms.ts` (e.g. `"from-green-200 via-emerald-100 to-lime-200"`) ARE picked up by the Tailwind scanner because they're literal — no safelist needed. `tsc` can't verify them though, so eyeball new gradients in the browser.

## Exit doors (scene-themed)

The exit renders `DOOR_ART[room.scene] ?? {open:"doorOpen", locked:"doorLocked"}`. Add a `{open,locked}` pair of `PROP_ART` keys per scene to theme it (e.g. `festival` → carnival gate). Provide both a **locked** state (closed + padlock) and an **open** state (revealed/glowing) — the door pulses when `exitReady`.

## Touch controls

RoomMap movement is keyboard (arrows/WASD) + an **on-screen D-pad** rendered only on touch (`matchMedia("(pointer: coarse)")`, checked in a mount effect to avoid SSR/hydration mismatch). The D-pad writes the same `velRef` the keyboard loop reads. Without it, layout/carry rooms are unplayable on tablets. Machines/notes/items are also tappable directly.

## Theme every prop, texture & door — three layers

Nothing in a room should be generic. Every prop, floor texture, exit door and colour must reinforce theme at **three nested levels**, and they must agree with each other. When adding anything, ask: does it fit the scene, this room, AND this puzzle?

1. **The escape room / scene** (`room.scene` + its world — the Robot Lab, the Festival, the Garden City, the History Vault). Sets the floor texture (`floorKind`), the base palette (`wall`/`floor`), the exit-door skin (`DOOR_ART`), and the ambient prop vocabulary. A lab → metal tread plate + server racks + cables; a garden → grass + flowers; a hawker centre → wood/market floor + food carts; a vault → stone/marble + pedestals + columns.

2. **The individual room** (each `GridCell.label`/`role` — "Hawker Stall", "Little India", "Gardens", "Robot Helper", "Control Panel", "Exit Keypad"). Localise decor to that sub-theme even within one scene. In the Festival: the Hawker Stall gets a food cart + stools; Little India gets diyas + rangoli + a dhol; the Gardens get a green floor + flowers; the Fruit Stall gets fruit crates. Use `cell.floor` / `cell.floorKind` to shift a single room (e.g. the green Gardens floor amid the amber festival).

3. **The puzzle** (the station's subject / answer). Echo the puzzle visually so the room hints at what it's about — a **visual reinforcement, not a giveaway** (show the subject, not the solved answer). Examples: the Fruit Stall's durian cipher → the crate features a **durian**; Little India's Diwali unscramble → **lights** (diyas); the Gardens' national-flower question → **orchids/flowers**; the Robot Helper build puzzle → **half-built robots**; a control-panel puzzle → **screens/consoles**.

Make the three agree: a room's floor, props, machine skin, and (if it's the exit) door should read as one place. A mismatched asset breaks the illusion — a wooden floor in a metal lab, a random emoji prop, or (for real-world themes) a culturally wrong motif. **Get real cultures right:** Little India = diyas / rangoli / dhol, NOT a Chinatown red paper lantern; don't grab a generic "festive" asset.

## Workflow

1. **One room at a time.** Add/reuse `PROP_ART`, place `decor` + set `mx`/`my` in `escape-rooms.ts`, then have the user screenshot and nudge positions. Placing several rooms blind needs too much re-tuning.
2. **Verify with `npx tsc --noEmit`, not `npm run build`.** A production build clobbers `.next` under a running dev server and unstyles the whole site (see the repo's dev-server notes). `tsc` type-checks without touching `.next`. `tsc` can't catch missing Tailwind classes or visual issues — those need the browser.
3. **Keep it fraction-based.** Prop `x/y`, `mx/my`, and plate-aligned motifs use fractions/percentages so they survive the responsive map scaling.
4. Reuse the **mechanisms**, not another theme's **art**. Reuse: `ceiling`/`flat`/`w-h` flags, `cell.floor`/`floorKind`, `DOOR_ART`, `FLOOR_TEXTURE`/`FLOOR_GRID`, the per-plate grid, `mx/my`. But **author fresh, on-theme `PROP_ART` for each scene's decor** — do NOT drop one theme's props into another (a lab `screen`/`crate`/`cable` in a superhero HQ reads wrong; make a `heroConsole`/`gadgetCrate`/`energyConduit`). Most new looks are data + a few bespoke art entries, not new engine code.

## Common gotchas (all real, from experience)

- **Avatar won't move at all** → a collision box is trapping the spawn (keep the spawn guard, keep boxes small) OR a hooks-order change left Fast Refresh stale (hard-reload).
- **Props cover the room title** → titles are z-55 on purpose; don't drop them below ceiling props (z-45). Also nudge top-of-room ceiling props off the title.
- **Motif misaligned across plates** → size it in `%` tied to the plate grid, not px.
- **Cables/bunting look like a floating line** → give the stretched box enough `h` for the catenary droop to show; use `non-scaling-stroke`.
- **New Tailwind gradient shows unstyled** → confirm the literal class string is in a scanned source file (it is, in `escape-rooms.ts`); a full class name must appear literally.
- **A room feels boxed off** → only cell pairs listed in `doors` are connected; add the pair if you intend them to link.
