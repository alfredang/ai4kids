/**
 * Sample AI Escape Rooms for the kids learning portal.
 *
 * Each room is a little *scene* you explore: a character walks up to clickable
 * objects ("stations"), and each object triggers a short, kid-friendly,
 * educational puzzle. Solve every object's puzzle to unlock the door and escape.
 *
 * Themes are simplified from the AI Vault escape-room project
 * (junngithub/escaperooms) — AI basics, data & patterns, and AI ethics / online
 * safety — re-pitched for ages 7–12.
 *
 * Content is fully static (no AI/API at play time). Each room maps 1:1 to a row
 * in the `activities` table via `activitySlug` (see scripts/seed-portal.ts) and
 * to a route at /learn/escape-room/<slug>.
 */

import { HONESTY_MAZES, type MazeVariant } from "./maze-pool";

// TODO: Make the rooms more engaging and less repetitive. Every room currently
// follows the same 4-station mcq → order → code → wordsearch template with the
// same object positions. Ideas: vary the number/layout of stations per room;
// add new puzzle kinds (matching pairs, slider/maze, drag-to-sort, cipher,
// spot-the-difference, audio/phonics); branching or sequential locks where one
// puzzle reveals a clue for the next; per-room narrative beats and a timer or
// star rating; richer scene interactivity (hotspots, inventory items).

export type EscapeRoomPuzzle =
  | {
      kind: "mcq";
      prompt: string;
      emoji?: string;
      options: string[];
      answerIndex: number;
      hint: string;
      /** Friendly fact shown after the puzzle is solved. */
      learn: string;
    }
  | {
      kind: "code";
      prompt: string;
      emoji?: string;
      /** Accepted answer; matched case-insensitively after trimming. */
      answer: string;
      /** The clue shown on the lock screen. */
      clue: string;
      hint: string;
      learn: string;
    }
  | {
      kind: "order";
      prompt: string;
      emoji?: string;
      /** Items listed in the CORRECT order; shown shuffled to the player. */
      items: string[];
      hint: string;
      learn: string;
    }
  | {
      kind: "wordsearch";
      prompt: string;
      emoji?: string;
      /** Words to find (letters only); a grid is generated around them. */
      words: string[];
      /**
       * Words shown as `?` in the to-find list (never spelled out and never lit by
       * a station). The player must work out what they are from a clue elsewhere
       * (e.g. the room note) and still find them in the grid. Unlike a provider-gated
       * word these stay searchable and don't keep the grid scrambled.
       */
      secret?: string[];
      /** Optional grid size; defaults to fit the longest word (min 7). */
      size?: number;
      /**
       * Optional fixed grid (rows of single uppercase letters). When set, the
       * generator is skipped — used for deterministic puzzles where the words
       * must cross at a known cell.
       */
      layout?: string[][];
      /**
       * 0-indexed [row, col] where the words all cross. When set, the grid
       * shows numbered axes, highlights the crossing once solved, and its
       * 1-indexed Column/Row become the room's exit-door code.
       */
      intersection?: [number, number];
      hint: string;
      learn: string;
    }
  | {
      kind: "cipher";
      prompt: string;
      emoji?: string;
      /**
       * A substitution legend: `symbols[i]` always stands for `letters[i]`.
       * It is NOT a uniform shift (Caesar) — every symbol maps to its own
       * letter, so the only way to read the message is to look each one up.
       */
      symbols: string[];
      letters: string[];
      /** The secret word written in symbols (each drawn from `symbols`). */
      coded: string[];
      /** What `coded` decodes to via the legend; the player types this in. */
      answer: string;
      hint: string;
      learn: string;
    }
  | {
      kind: "circuit";
      prompt: string;
      emoji?: string;
      /**
       * Grid of pipe tiles. `sides` are the open edges at rotation 0; `rot`
       * (0-3) is the starting quarter-turn. Tapping a tile rotates it 90° CW.
       * Solved when an unbroken path links `start` to `end`.
       */
      tiles: { sides: Dir[]; rot: number }[][];
      /** Power source plugs into this cell from its `from` edge. */
      start: { r: number; c: number; from: Dir };
      /** Bulb plugs out of this cell on its `to` edge. */
      end: { r: number; c: number; to: Dir };
      hint: string;
      learn: string;
    }
  | {
      kind: "sort";
      prompt: string;
      emoji?: string;
      /** The two bins to drop statements into. */
      bins: [SortBin, SortBin];
      /** Each item belongs in bin 0 or bin 1. */
      items: { text: string; bin: number }[];
      hint: string;
      learn: string;
    }
  | {
      kind: "maze";
      prompt: string;
      emoji?: string;
      /** Pool of maze variants (grid + on-path signs); one is chosen at random
       *  each play — see scripts/gen-mazes.cjs and src/lib/maze-pool.ts. */
      variants: MazeVariant[];
      /** Emoji drawn on the goal cell (default 💙). */
      goalEmoji?: string;
      /** Walking-hint caption under the maze (default mentions the honest path). */
      caption?: string;
      /** Caption shown once the hero reaches the goal (default honesty wording). */
      wonText?: string;
      hint: string;
      learn: string;
    }
  | {
      /**
       * Trail-map maze: read a map's ORDERED route of landmarks, then walk the
       * hero through the maze stepping on those landmarks in that exact order
       * before reaching the gate. Reuses the `maze` grid format (`#`/`.`/`S`/`G`)
       * and the same arrow move-pad. Fog of war hides unexplored cells, and the
       * route order stays locked until the `unlockedBy` station (the map) is solved.
       */
      kind: "trailmaze";
      prompt: string;
      emoji?: string;
      /**
       * Station id that must be solved before the route order is revealed (e.g.
       * the Trail Map word search). Until then the maze stays locked and the map
       * strip shows `?` — you have to read the map to learn which way to walk.
       */
      unlockedBy?: string;
      /** Maze rows of single chars: `#` wall, `.` path, `S` start, `G` gate. */
      grid: string[];
      /** Landmarks dropped on path cells (0-indexed [row, col] + emoji). */
      landmarks: { at: [number, number]; emoji: string }[];
      /** The map's route: landmark emoji to step on, in this exact order. */
      route: string[];
      /** Emoji drawn on the gate / goal cell (default 🚪). */
      goalEmoji?: string;
      /** Caption under the maze while walking (default mentions the map order). */
      caption?: string;
      /** Caption shown once the trail is walked in full (default map wording). */
      wonText?: string;
      hint: string;
      learn: string;
    }
  | {
      kind: "fair";
      prompt: string;
      emoji?: string;
      /** Animals to feed (emoji); each must end with the same number of treats. */
      animals: string[];
      /** Treat emoji. */
      treat: string;
      /** Total treats to share out (should divide evenly among the animals). */
      total: number;
      hint: string;
      learn: string;
    }
  | {
      /**
       * Acrostic crossword (ported from the Android `Crossword`): drag/tap each
       * answer into its numbered row; the letters down `secretCol` spell a
       * hidden word. Solved when every row holds its matching word.
       */
      kind: "crossword";
      prompt: string;
      emoji?: string;
      rows: {
        /** Clue number shown on the first cell. */
        num: number;
        /** The answer placed in this row. */
        word: string;
        /** Starting grid column (0-indexed) so the words form an acrostic. */
        offset: number;
        /** Short clue shown in the tray legend. */
        clue?: string;
      }[];
      /** Grid column whose letters (top→bottom) spell the secret word. */
      secretCol: number;
      /** The secret word the column spells (for the review/learn copy). */
      secret: string;
      hint: string;
      learn: string;
    }
  | {
      /**
       * Unscramble (ported from the Android `Unscramble`): tap the shuffled
       * letter tiles in order to spell each word; words are solved in sequence.
       */
      kind: "unscramble";
      prompt: string;
      emoji?: string;
      /** Words to unscramble, in order (e.g. ["SINGA", "PURA"]). */
      words: string[];
      /** Optional clue per word (parallel to `words`). */
      clues?: string[];
      hint: string;
      learn: string;
    }
  | {
      /**
       * Symbol lock (ported from the Android `SymbolLock`): a letter→symbol key
       * is shown; tap the symbols in order to spell the secret `word`.
       */
      kind: "symbol-lock";
      prompt: string;
      emoji?: string;
      /** The secret word to spell out in symbols (e.g. "LION"). */
      word: string;
      /** Symbol palette (emoji); the first distinct-letter count become the key. */
      symbols?: string[];
      /** Extra non-answer symbols mixed into the palette. */
      decoys?: number;
      hint: string;
      learn: string;
    };

/** Compass edge of a circuit tile. */
export type Dir = "N" | "E" | "S" | "W";

/** Which hand-drawn SVG backdrop a room paints behind its scene. */
export type SceneKind = "lab" | "hero" | "eco" | "history" | "festival" | "nature";

/** One bin in a `sort` puzzle. */
export type SortBin = { label: string; emoji: string };

/**
 * A clue a station hands out the moment its puzzle is solved, chaining the
 * room's puzzles together. A `word` clue unlocks a target in another station's
 * word search; it surfaces only as a picture clue (`emoji`) — never the
 * spelled-out word — so the player still has to work out what to hunt for.
 */
export type StationClue = { kind: "word"; to: string; word: string; emoji: string };

/**
 * A door unlocked by decoding a substitution cipher. Each named station's solve
 * reveals one piece — the key symbols, the key letters, or the coded message —
 * and only with all three can the player decrypt `answer` and type it in.
 */
export type RoomCipherExit = {
  kind: "cipher";
  symbols: string[];
  letters: string[];
  coded: string[];
  answer: string;
  /** Station id whose solve reveals the legend symbols. */
  revealSymbols: string;
  /** Station id whose solve reveals the legend letters. */
  revealLetters: string;
  /** Station id whose solve reveals the coded message to decrypt. */
  revealCoded: string;
  /** Themed banner copy while solving (the `N/total` count is appended). */
  progressHint?: string;
  /** Themed banner copy once every station is solved. */
  readyHint?: string;
};

/**
 * A door unlocked by unscrambling several words. Each station's solve reveals
 * one scrambled word (its "core"); unscrambling every word opens the door.
 */
export type RoomUnscrambleExit = {
  kind: "unscramble";
  words: {
    /** The correct word the player types. */
    answer: string;
    /** The shuffled letters shown once `reveal` is solved. */
    scrambled: string;
    /** Station id whose solve reveals this word. */
    reveal: string;
    /** Core emoji + name shown beside the word. */
    emoji: string;
    core: string;
  }[];
  /** Themed banner copy while solving (the `N/total` count is appended). */
  progressHint?: string;
  /** Themed banner copy once every station is solved. */
  readyHint?: string;
};

/** A clickable object in the room that opens a puzzle. */
export type Station = {
  id: string;
  emoji: string;
  /** Short name shown under the object. */
  label: string;
  /** Position in the scene, 0–100 (% from left / top). */
  x: number;
  y: number;
  /** Clues revealed once this station's puzzle is solved (see StationClue). */
  provides?: StationClue[];
  puzzle: EscapeRoomPuzzle;
};

/* ------------------------------------------------------------------ */
/* Navigable room-grid layout (top-down rooms + walls + free movement) */
/* ------------------------------------------------------------------ */

/** One room on the grid. A puzzle room hosts a Station's machine by id. */
export type GridCell = {
  id: string;
  label: string;
  gx: number;
  gy: number;
  gw?: number; // grid width in cells (default 1)
  gh?: number; // grid height in cells (default 1)
  /** Station whose puzzle "machine" stands in this room. */
  stationId?: string;
  /** Where the machine stands, as 0–1 fractions of the room (default centred). */
  mx?: number;
  my?: number;
  role?: "spawn" | "puzzle" | "exit";
  /** Lock this room's machine until this station id is solved. */
  requires?: string;
  /** Lock this room's machine until every listed station id is solved. */
  requiresAll?: string[];
};

/**
 * A world item the player can pick up and carry between rooms. Ported from the
 * Android escape room's carry mechanic (`EscapeGdxGame.kt`, `doAction()`).
 */
export type CarryItem = {
  id: string;
  emoji: string;
  label: string;
  /** StationIcon name override (defaults to the station's icon, or a bottle). */
  icon?: string;
  /**
   * charge/direct mode: the station this item belongs to — the charger you carry
   * a loose core to (charge mode), or the gallery it sits in (direct mode).
   */
  station?: string;
  /** recycle mode: the room the bottle starts scattered in. */
  home?: string;
};

/**
 * How a room's carriable items behave, mirroring the three Android levels:
 *  - "charge"  (kindness-castle / Tower): loose cores sit in `coreRoom`; carry
 *    each to its solved charger station to CHARGE it, then to `suitRoom` to
 *    DELIVER. The suit's exit stays locked until every core is delivered.
 *  - "direct"  (sg-history / Vault): each artefact rests in its own gallery and
 *    is pickable only once that gallery is solved; carry it straight to
 *    `suitRoom` (the Time Capsule) to PLACE it. No charge step.
 *  - "recycle" (green-lab / Annex): bottles scatter across their `home` rooms;
 *    WASH each at the sink in `sinkRoom`, then DEPOSIT at the recycler in
 *    `depositRoom`. `gateRoom`'s puzzle stays locked until every bottle is in.
 */
export type CarryConfig =
  | { mode: "charge"; items: CarryItem[]; coreRoom: string; suitRoom: string }
  | { mode: "direct"; items: CarryItem[]; suitRoom: string }
  | { mode: "recycle"; items: CarryItem[]; sinkRoom: string; depositRoom: string; gateRoom: string };

/** A read-only clue / "lab note" object placed in a room. */
export type RoomNote = {
  id: string;
  room: string;
  emoji: string;
  title: string;
  body?: string;
  /** Optional small diagram keyed by name (e.g. "crossing", "map", "coremap"). */
  art?: "crossing" | "coremap";
};

/** A purely cosmetic prop placed in a room — no interaction, no collision. */
export type RoomDecor = {
  /** Cell id the prop stands in. */
  room: string;
  /** Art key into the map's prop SVG set (e.g. "crate", "barrel", "serverRack"). */
  art: string;
  /** Position within the room, as 0..1 fractions of its width / height. */
  x: number;
  y: number;
  /** Size multiplier (default 1). Ignored when w/h are set. */
  scale?: number;
  /** Mirror horizontally for variety. */
  flip?: boolean;
  /** Explicit size as fractions of the room's width / height → drawn stretched
   *  (e.g. a cable conduit running across the room). Both must be set. */
  w?: number;
  h?: number;
};

/** The grid of rooms, walls and world objects for a navigable escape room. */
export type RoomLayout = {
  cols: number;
  rows: number;
  cells: GridCell[];
  /** Connected room-id pairs — a doorway gap opens in their shared wall. */
  doors: [string, string][];
  /** Room the character spawns in. */
  spawn: string;
  /** Room hosting the final lock (the room's `exit` mechanism). */
  exit: string;
  /** Optional pick-up-and-carry mechanic (cores / artefacts / bottles). */
  carry?: CarryConfig;
  notes?: RoomNote[];
  /** Purely cosmetic props scattered in rooms (drawn behind machines). */
  decor?: RoomDecor[];
};

export type EscapeRoom = {
  /** Route param, e.g. "robot-lab" → /learn/escape-room/robot-lab */
  slug: string;
  /** Matching row in the `activities` table. */
  activitySlug: string;
  title: string;
  emoji: string;
  tagline: string;
  ageRange: string;
  /** Tailwind accent classes for the room header (bg + text). */
  accent: string;
  ring: string;
  /** Tailwind gradient classes for the scene wall / back of the room. */
  wall: string;
  /** Tailwind gradient classes for the scene floor strip. */
  floor: string;
  /** Themed texture painted over the wall. */
  pattern: "circuit" | "dots" | "leaves" | "none";
  /** Themed look for the floor strip. */
  floorKind: "metal" | "tile" | "wood";
  /** Hand-drawn SVG backdrop illustration for the room (no emojis). */
  scene: SceneKind;
  /** Emoji avatar that explores the room. */
  character: string;
  /** Story setup shown before entering. */
  intro: string;
  /** Cheer shown when the learner escapes. */
  outro: string;
  stations: Station[];
  /** Optional special exit mechanism (otherwise: solve all, walk out). */
  exit?: RoomCipherExit | RoomUnscrambleExit;
  /**
   * Navigable room-grid layout — the room is played as a top-down map of rooms +
   * walls with free movement (see RoomMap).
   */
  layout: RoomLayout;
};

export const ESCAPE_ROOMS: EscapeRoom[] = [
  {
    slug: "robot-lab",
    activitySlug: "escape-robot-lab",
    title: "The Robot Lab",
    emoji: "🤖",
    tagline: "Explore the lab and fix the machines to escape!",
    ageRange: "7–9",
    accent: "bg-sky/15 text-sky-600",
    ring: "ring-sky/30",
    wall: "from-slate-800 via-indigo-900 to-indigo-950",
    floor: "from-slate-500 to-slate-700",
    pattern: "circuit",
    floorKind: "metal",
    scene: "lab",
    character: "🧑‍🚀",
    intro:
      "Beep boop! You're exploring Professor Pixel's Robot Lab when the door clicks shut. Fix the three machines to light up three secret words on the display — where they all cross is the code that opens the door!",
    outro: "The exit hums to life and slides open! The robot gives you a high-five. 🙌",
    stations: [
      {
        id: "panel",
        emoji: "🎛️",
        label: "Control Panel",
        x: 16,
        y: 30,
        // Lights up the word ROBOT (as a 🤖 picture clue) on the poster.
        provides: [{ kind: "word", to: "poster", word: "ROBOT", emoji: "🤖" }],
        puzzle: {
          kind: "code",
          emoji: "🔢",
          prompt: "Robots are hiding among the other machines. Count the 🤖 robots and type how many.",
          clue: "⚙️ 🤖 🤖 🛰️ 🤖 🪐 🤖 ✨ 🔋 🤖 ⚙️ 🤖",
          answer: "6",
          hint: "Touch each 🤖 as you count — skip the gears, planets and other machines.",
          learn: "Great counting! 🤖 The word ROBOT will light up on the word display — go hunt for it!",
        },
      },
      {
        id: "robot",
        emoji: "🤖",
        label: "Robot Helper",
        x: 44,
        y: 22,
        // Lights up the word LEARN (as a 📚 picture clue) on the poster.
        provides: [{ kind: "word", to: "poster", word: "LEARN", emoji: "📚" }],
        puzzle: {
          kind: "order",
          emoji: "🐱",
          prompt: "Teach the robot to spot cats. Tap the 3 steps in the right order:",
          items: [
            "Show the robot lots of cat photos",
            "The robot spots the pattern",
            "The robot guesses 'cat!' on a new photo",
          ],
          hint: "First it looks, then it thinks, then it answers.",
          learn: "That's how machines learn — from lots of examples! 📚 The word LEARN will light up on the display.",
        },
      },
      {
        id: "decoder",
        emoji: "🔣",
        label: "Symbol Decoder",
        x: 72,
        y: 30,
        // Decrypts the secret word GEAR and lights it up (as a ⚙️ clue) on the poster.
        provides: [{ kind: "word", to: "poster", word: "GEAR", emoji: "⚙️" }],
        puzzle: {
          kind: "cipher",
          emoji: "🔣",
          prompt: "Use the decoder key to read the secret word, then type it in.",
          // Substitution legend: each symbol = its own letter (not a shift). The
          // answer's letters (G,E,A,R) are scattered through the key on purpose,
          // so you have to hunt each symbol down rather than read them in a row.
          symbols: ["💡", "⚙️", "🛰️", "🔋", "📡", "🪐", "🤖", "🔌", "✨", "🔧", "🧲", "🔩"],
          letters: ["S", "G", "O", "E", "T", "N", "A", "L", "I", "R", "D", "C"],
          coded: ["⚙️", "🔋", "🤖", "🔧"],
          answer: "GEAR",
          hint: "Find each message symbol in the key and jot its letter — they're spread all over.",
          learn: "You cracked the code! ⚙️ The word GEAR will light up on the display.",
        },
      },
      {
        id: "poster",
        emoji: "🖥️",
        label: "Word Display",
        x: 42,
        y: 56,
        puzzle: {
          kind: "wordsearch",
          emoji: "🔎",
          prompt: "Three words will light up on this display. Find all three words — they all cross at one square!",
          words: ["ROBOT", "LEARN", "GEAR"],
          // Deterministic grid: ROBOT (→), LEARN (↓) and GEAR (↘) all share the
          // R at row 4, col 3 (0-indexed) → exit code Column 4, Row 5.
          layout: [
            ["Z", "X", "Q", "K", "V", "W", "Y", "J"],
            ["G", "P", "D", "L", "H", "U", "F", "M"],
            ["C", "E", "V", "E", "K", "X", "Q", "Z"],
            ["W", "Y", "A", "A", "J", "P", "D", "H"],
            ["K", "V", "Q", "R", "O", "B", "O", "T"],
            ["X", "Z", "J", "N", "C", "W", "Y", "F"],
            ["M", "P", "U", "D", "K", "V", "Q", "X"],
            ["H", "F", "C", "Z", "J", "W", "Y", "P"],
          ],
          intersection: [4, 3],
          hint: "ROBOT goes across, LEARN goes down, GEAR goes slanted — find where they meet.",
          learn: "ROBOT, LEARN and GEAR all cross at one square! Read that square's Column and Row, then key them into the door. 🔢",
        },
      },
    ],
    // 3×3 with a wide central hub ("Main Lab") and a tall Word Display; the exit
    // keypad is reachable only via the Control Panel or Word Display (not the
    // hub) so the route isn't trivial. Mirrors the Android Robot Lab grid.
    layout: {
      cols: 4,
      rows: 2,
      cells: [
        { id: "entrance", label: "Entrance", gx: 0, gy: 0, role: "spawn" },
        { id: "atrium", label: "Main Lab", gx: 1, gy: 0, gw: 2 },
        { id: "exit", label: "Exit Keypad", gx: 3, gy: 0, role: "exit" },
        { id: "decoder", label: "Symbol Decoder", gx: 0, gy: 1, stationId: "decoder", role: "puzzle", mx: 0.34, my: 0.42 },
        { id: "robot", label: "Robot Helper", gx: 1, gy: 1, stationId: "robot", role: "puzzle", mx: 0.66, my: 0.46 },
        { id: "panel", label: "Control Panel", gx: 2, gy: 1, stationId: "panel", role: "puzzle", mx: 0.68, my: 0.36 },
        { id: "poster", label: "Word Display", gx: 3, gy: 1, stationId: "poster", role: "puzzle", mx: 0.38, my: 0.66 },
      ],
      doors: [
        ["entrance", "atrium"],
        ["entrance", "decoder"],
        ["atrium", "robot"],
        ["atrium", "panel"],
        ["panel", "poster"],
        ["poster", "exit"],
      ],
      spawn: "entrance",
      exit: "exit",
      notes: [
        {
          id: "lab-note",
          room: "atrium",
          emoji: "📋",
          title: "Lab Note",
          art: "crossing",
        },
      ],
      decor: [
        // Main Lab — a row of server racks along the top wall...
        { room: "atrium", art: "serverRack", x: 0.09, y: 0.22, scale: 1.5 },
        { room: "atrium", art: "serverRack", x: 0.2, y: 0.22, scale: 1.5 },
        { room: "atrium", art: "serverRack", x: 0.31, y: 0.22, scale: 1.5 },
        // ...with cables drooping from them across to the far wall...
        { room: "atrium", art: "cable", x: 0.67, y: 0.19, w: 0.65, h: 0.2 },
        // ...and a build area on the floor below (kept off the bottom-wall doors).
        { room: "atrium", art: "halfRobot", x: 0.1, y: 0.8, scale: 1.2 },
        { room: "atrium", art: "crate", x: 0.94, y: 0.85, scale: 0.8 },
        // A storage shelf in the upper-right corner.
        { room: "atrium", art: "shelf", x: 0.9, y: 0.24, scale: 1.3 },
      
        // A rack against the Word Display wall, cabled to the wall beside it.
        { room: "poster", art: "serverRack", x: 0.8, y: 0.26, scale: 1.35 },
        { room: "poster", art: "cable", x: 0.38, y: 0.24, w: 0.7, h: 0.18 },
        // Half-built robots being assembled around the lab (hugging corners).
        { room: "robot", art: "halfRobot", x: 0.24, y: 0.76, scale: 1.4 },
        { room: "decoder", art: "halfRobot", x: 0.76, y: 0.74, scale: 1.4, flip: true },
        { room: "entrance", art: "halfRobot", x: 0.87, y: 0.2, scale: 1.25 },
        { room: "entrance", art: "crate", x: 0.13, y: 0.82, scale: 1.1 },
        // Dummy control monitors (non-interactive) in the Control Panel & Exit rooms.
        { room: "panel", art: "screen", x: 0.28, y: 0.76, scale: 1.15 },
        { room: "exit", art: "screen", x: 0.26, y: 0.3, scale: 1.2 },
        { room: "exit", art: "screen", x: 0.74, y: 0.3, scale: 1.2 },
      ],
    },
  },
  {
    slug: "kindness-castle",
    activitySlug: "escape-kindness-castle",
    title: "The Superhero Suit",
    emoji: "🦸",
    tagline: "Power three hero cores to charge up the suit and escape!",
    ageRange: "8–11",
    accent: "bg-grape/15 text-grape",
    ring: "ring-grape/30",
    wall: "from-fuchsia-200 via-purple-200 to-indigo-200",
    floor: "from-stone-400 to-stone-600",
    pattern: "dots",
    floorKind: "tile",
    scene: "hero",
    character: "🦸",
    intro:
      "The hero suit is out of power! It needs three cores — Kindness, Honesty and Fairness. Charge up each core, then use them to reveal the suit's secret passwords and power the door open!",
    outro: "The suit lights up and wearing it, you zoom out the door — you're a true superhero! 🦸",
    // The suit door: each core (station) reveals one scrambled word to crack.
    exit: {
      kind: "unscramble",
      progressHint: "⚡ Charge the hero cores to power the suit",
      readyHint: "🦸 All cores charged — open the suit and reveal the words!",
      words: [
        { answer: "KIND", scrambled: "DNIK", reveal: "kindness", emoji: "💚", core: "Kindness Core" },
        { answer: "TRUE", scrambled: "ETUR", reveal: "honesty", emoji: "💙", core: "Honesty Core" },
        { answer: "FAIR", scrambled: "RIAF", reveal: "fairness", emoji: "💛", core: "Fairness Core" },
      ],
    },
    stations: [
      {
        id: "kindness",
        emoji: "💚",
        label: "Kindness Core",
        x: 17,
        y: 30,
        puzzle: {
          kind: "sort",
          emoji: "💚",
          prompt: "Drop each sentence into the correct bin to charge the Kindness Core.",
          bins: [
            { label: "Kind", emoji: "💚" },
            { label: "Mean", emoji: "💢" },
          ],
          items: [
            { text: "Want to play with us?", bin: 0 },
            { text: "You can't sit here!", bin: 1 },
            { text: "Great try — well done!", bin: 0 },
            { text: "Nobody likes you.", bin: 1 },
            { text: "Here, let me help you up.", bin: 0 },
            { text: "That's a dumb idea.", bin: 1 },
          ],
          hint: "Kind words help and include people; mean words hurt or leave people out.",
          learn: "Kind words make people feel good and included — that's the Kindness Core charged! 💚",
        },
      },
      {
        id: "honesty",
        emoji: "💙",
        label: "Honesty Core",
        x: 46,
        y: 22,
        puzzle: {
          kind: "maze",
          emoji: "💙",
          prompt: "Find the honest path to the core. At each fork, the truthful choice goes forward — a lie is a dead end!",
          variants: HONESTY_MAZES,
          hint: "Read each signpost — the honest choice is the way forward.",
          learn: "Telling the truth, even when it's hard, is what honesty means — Honesty Core charged! 💙",
        },
      },
      {
        id: "fairness",
        emoji: "💛",
        label: "Fairness Core",
        x: 72,
        y: 31,
        puzzle: {
          kind: "fair",
          emoji: "💛",
          prompt: "Share the food so every animal gets exactly the same. Be fair!",
          animals: ["🐶", "🐱", "🦊"],
          treat: "🍖",
          total: 9,
          hint: "Nine pieces of food shared between three friends — how many does each one get?",
          learn: "Sharing equally so everyone gets the same is what being fair means — Fairness Core charged! 💛",
        },
      },
    ],
    // 2×4 tower with wide foyer + landing and a snake-path door set — you wind
    // foyer → fairness → honesty → landing → kindness → suit, so adjacent rooms
    // are NOT all connected. Cores live on the wide Landing. Mirrors the Android
    // Tower grid.
    layout: {
      cols: 4,
      rows: 2,
      cells: [
        { id: "foyer", label: "Foyer", gx: 0, gy: 0, gh: 2, role: "spawn" },
        { id: "honesty", label: "Honesty Charger", gx: 1, gy: 0, stationId: "honesty", role: "puzzle" },
        { id: "landing", label: "Core Landing", gx: 2, gy: 0, gh: 2 },
        { id: "attic", label: "The Suit", gx: 3, gy: 0, role: "exit" },
        { id: "fairness", label: "Fairness Charger", gx: 1, gy: 1, stationId: "fairness", role: "puzzle" },
        { id: "kindness", label: "Kindness Charger", gx: 3, gy: 1, stationId: "kindness", role: "puzzle" },
      ],
      doors: [
        ["foyer", "fairness"],
        ["fairness", "honesty"],
        ["honesty", "landing"],
        ["landing", "kindness"],
        ["kindness", "attic"],
      ],
      spawn: "foyer",
      exit: "attic",
      // Loose cores sit on the Landing. Carry each to its charger station (once
      // solved) to charge it, then ferry the charged core to the Suit.
      carry: {
        mode: "charge",
        coreRoom: "landing",
        suitRoom: "attic",
        // The loose cores look identical (no colour / label) until charged — the
        // Landing note hints which core, by position, belongs to which charger.
        items: [
          { id: "core-kindness", emoji: "⚪", label: "core", station: "kindness" },
          { id: "core-honesty", emoji: "⚪", label: "core", station: "honesty" },
          { id: "core-fairness", emoji: "⚪", label: "core", station: "fairness" },
        ],
      },
      notes: [
        {
          id: "delivery-map",
          room: "landing",
          emoji: "🗺️",
          title: "Suit Manual",
          body: "The power cores look exactly alike — but each is numbered. This map shows which charger each numbered core belongs to. Carry each core to its charger, solve the puzzle to charge it, then bring all three to the Suit!",
          art: "coremap",
        },
      ],
    },
  },
  {
    slug: "green-lab",
    activitySlug: "escape-green-lab",
    title: "The Recycling Plant",
    emoji: "♻️",
    tagline: "Switch the power back on and recycle your way out!",
    ageRange: "9–12",
    accent: "bg-mint/15 text-emerald-600",
    ring: "ring-mint/30",
    wall: "from-teal-100 via-emerald-100 to-lime-100",
    floor: "from-amber-700 to-amber-900",
    pattern: "leaves",
    floorKind: "wood",
    scene: "eco",
    character: "🧑‍🔬",
    intro:
      "Welcome to the recycling plant! A power cut has shut the doors and powered down the exit decoder. Fix the three machines to power the plant back up — then crack the decoder code to get out!",
    outro: "The recycling plant whirs back to life and the doors slide open — you're an Earth hero! ♻️",
    // Cipher-locked door: each machine powers one part of the decoder.
    exit: {
      kind: "cipher",
      // Scattered substitution legend; the answer's symbols (P,O,W,E,R) sit at
      // positions 2,4,7,10,14 so they're spread across the key, not in a row.
      symbols: ["💧", "🔋", "🗑️", "☀️", "🍃", "🥤", "💨", "🌍", "📦", "♻️", "⚡", "🔌", "🌳", "🌱", "🌿"],
      letters: ["S", "P", "T", "O", "N", "A", "W", "Y", "C", "E", "G", "I", "D", "R", "L"],
      coded: ["🔋", "☀️", "💨", "♻️", "🌱"], // P O W E R
      answer: "POWER",
      revealSymbols: "circuit", // circuit connector → decoder symbols
      revealLetters: "bins", // recycling bins → decoder letters
      revealCoded: "panel", // solar panel → the coded message
      progressHint: "🔌 Fix the machines to power the door's decoder",
      readyHint: "🔣 All powered up — open the door and crack the decoder code!",
    },
    stations: [
      {
        id: "panel",
        emoji: "☀️",
        label: "Solar Panel",
        x: 17,
        y: 30,
        puzzle: {
          kind: "mcq",
          emoji: "⚡",
          prompt: "Which power comes from the sun and never runs out?",
          options: ["Solar power", "Burning coal", "Plastic bags"],
          answerIndex: 0,
          hint: "Look up on a sunny day!",
          learn: "Solar, wind and water are renewable energy — clean power that won't run out! ☀️ The door's secret message lights up.",
        },
      },
      {
        id: "bins",
        emoji: "♻️",
        label: "Recycling Plant",
        x: 46,
        y: 22,
        puzzle: {
          kind: "order",
          emoji: "🍶",
          prompt: "Recycle a plastic bottle the right way. Put the steps in order:",
          items: [
            "Empty and rinse the bottle",
            "Drop it in the recycling bin",
            "It's made into something new!",
          ],
          hint: "Clean it first, then sort it, then it gets reused.",
          learn: "Recycling turns old bottles into new things and keeps rubbish out of nature! ♻️ The decoder's letters light up.",
        },
      },
      {
        id: "circuit",
        emoji: "🔌",
        label: "Power Circuit",
        x: 72,
        y: 31,
        puzzle: {
          kind: "circuit",
          emoji: "🔌",
          prompt: "The power's out! Tap the tiles to spin them and connect ⚡ to the 💡.",
          // 3×3 of pipe tiles; rotate the path tiles to link start → end.
          tiles: [
            [
              { sides: ["E", "S"], rot: 0 },
              { sides: ["S", "W"], rot: 2 },
              { sides: ["N", "W"], rot: 1 },
            ],
            [
              { sides: ["N", "W"], rot: 1 },
              { sides: ["N", "E"], rot: 1 },
              { sides: ["E", "W"], rot: 1 },
            ],
            [
              { sides: ["N", "E"], rot: 2 },
              { sides: ["E", "W"], rot: 3 },
              { sides: ["N", "W"], rot: 1 },
            ],
          ],
          start: { r: 1, c: 0, from: "W" },
          end: { r: 1, c: 2, to: "E" },
          hint: "Each tap turns a tile. Make one unbroken line from ⚡ to 💡.",
          learn: "You fixed the circuit — clean power flows again! ⚡ The decoder's symbols light up.",
        },
      },
    ],
    // 3×3 (with two void cells, like the Android Annex): a wide Solar Panel and
    // a tall Recycling Plant. Three bottles must be washed AND recycled at the
    // Recycling Plant before the exit decoder will open.
    layout: {
      cols: 4,
      rows: 2,
      cells: [
        { id: "lobby", label: "Lobby", gx: 0, gy: 0, role: "spawn" },
        { id: "panel", label: "Solar Panel", gx: 1, gy: 0, gw: 2, stationId: "panel", role: "puzzle" },
        { id: "exit", label: "Exit Decoder", gx: 3, gy: 0, role: "exit" },
        { id: "bins", label: "Recycling Plant", gx: 0, gy: 1, gw: 2, stationId: "bins", role: "puzzle" },
        { id: "circuit", label: "Power Circuit", gx: 2, gy: 1, gw: 2, stationId: "circuit", role: "puzzle" },
      ],
      doors: [
        ["lobby", "panel"],
        ["lobby", "bins"],
        ["bins", "circuit"],
        ["circuit", "exit"],
      ],
      spawn: "lobby",
      exit: "exit",
      // Three bottles scatter across the plant. Wash each at the sink in the
      // Recycling Plant, recycle it at the recycler in the opposite corner, then
      // the gated Power Circuit unlocks.
      carry: {
        mode: "recycle",
        sinkRoom: "bins",
        depositRoom: "bins",
        gateRoom: "circuit",
        items: [
          { id: "bottle-a", emoji: "🍶", label: "Bottle", icon: "bottle", home: "lobby" },
          { id: "bottle-b", emoji: "🍶", label: "Bottle", icon: "bottle", home: "panel" },
          { id: "bottle-c", emoji: "🍶", label: "Bottle", icon: "bottle", home: "bins" },
        ],
      },
      notes: [
        {
          id: "plant-note",
          room: "lobby",
          emoji: "📋",
          title: "Notice",
          body: "There are stray bottles around the plant. Recycle them the right way!",
        },
      ],
    },
  },
  {
    slug: "sg-history",
    activitySlug: "escape-sg-history",
    title: "The Singapore History Vault",
    emoji: "🦁",
    tagline: "Decode the old stone tablet to unlock the vault!",
    ageRange: "8–11",
    accent: "bg-coral/15 text-coral",
    ring: "ring-coral/30",
    wall: "from-amber-100 via-orange-100 to-red-100",
    floor: "from-stone-400 to-stone-600",
    pattern: "dots",
    floorKind: "tile",
    scene: "history",
    character: "🧑‍🎓",
    intro:
      "The History Vault is locked! Explore old Singapore — answer the Merlion, trace the river lanes and sort the old days from today. Each gallery hides a national treasure — carry all three to the Time Capsule to open the vault!",
    outro: "The last treasure clicks into the Time Capsule and the vault grinds open — the Merlion roars hello! 🦁",
    // No tablet/cipher: each gallery's puzzle frees a treasure you carry to the
    // central Time Capsule (Android Vault's direct-delivery model).
    stations: [
      {
        // Android Vault: west "Founding Gallery" — Mcq (1819).
        id: "merlion",
        emoji: "📜",
        label: "Founding Gallery",
        x: 17,
        y: 30,
        puzzle: {
          kind: "mcq",
          emoji: "⚓",
          prompt: "In which year did Raffles land and found modern Singapore?",
          options: ["1819", "1942", "1965"],
          answerIndex: 0,
          hint: "It's the earliest of the three years — the very start of the story.",
          learn: "Raffles landed in 1819, founding modern Singapore! 📜 The Founding Gallery opens — grab the Treaty Scroll for the Time Capsule.",
        },
      },
      {
        // Android Vault: east "Independence Hall" — NumberLock (1965).
        id: "timeline",
        emoji: "🇸🇬",
        label: "Independence Hall",
        x: 46,
        y: 22,
        puzzle: {
          kind: "code",
          emoji: "🇸🇬",
          prompt: "Key in the year Singapore became an independent nation.",
          clue: "🇸🇬 19 _ _",
          answer: "1965",
          hint: "It became independent in the 1960s — nineteen sixty-five.",
          learn: "Singapore became independent in 1965! 🇸🇬 Independence Hall opens — grab the National Flag for the Time Capsule.",
        },
      },
      {
        // Android Vault: top "Lion City Room" — Unscramble (SINGA, PURA).
        id: "river",
        emoji: "🦁",
        label: "Lion City Room",
        x: 72,
        y: 30,
        puzzle: {
          kind: "unscramble",
          emoji: "🦁",
          prompt: "Unscramble Singapore's old Malay name, one word at a time.",
          words: ["SINGA", "PURA"],
          clues: [
            "In Malay, the word for 'lion'.",
            "In Malay, this means 'city' — put it after Singa for Singapore's old name.",
          ],
          hint: "Singa = lion, Pura = city → Singapura.",
          learn: "'Singapura' means 'Lion City'! 🦁 The Lion City Room opens — grab the Merlion for the Time Capsule.",
        },
      },
    ],
    // Three galleries branch off a wide central Time Capsule (the exit). Each
    // gallery's puzzle frees a treasure you ferry to the capsule. Mirrors the
    // Android Vault's hub-and-spoke direct-delivery layout.
    layout: {
      cols: 4,
      rows: 2,
      cells: [
        { id: "hall", label: "Vault Entrance", gx: 0, gy: 0, role: "spawn" },
        { id: "merlion", label: "Founding Gallery", gx: 1, gy: 0, stationId: "merlion", role: "puzzle" },
        { id: "river", label: "Lion City Room", gx: 2, gy: 0, stationId: "river", role: "puzzle" },
        { id: "timeline", label: "Independence Hall", gx: 3, gy: 0, stationId: "timeline", role: "puzzle" },
        { id: "capsule", label: "Time Capsule", gx: 0, gy: 1, gw: 4, role: "exit" },
      ],
      doors: [
        ["hall", "merlion"],
        ["hall", "capsule"],
        ["merlion", "capsule"],
        ["river", "capsule"],
        ["timeline", "capsule"],
      ],
      spawn: "hall",
      exit: "capsule",
      // Each treasure rests in its gallery and is pickable only once that
      // gallery's puzzle is solved; carry all three to the Time Capsule.
      carry: {
        mode: "direct",
        suitRoom: "capsule",
        items: [
          { id: "art-treaty", emoji: "📜", label: "Treaty Scroll", icon: "note", station: "merlion" },
          { id: "art-merlion", emoji: "🦁", label: "Merlion", icon: "lion", station: "river" },
          { id: "art-flag", emoji: "🇸🇬", label: "National Flag", icon: "flag", station: "timeline" },
        ],
      },
      notes: [
        {
          id: "vault-note",
          room: "capsule",
          emoji: "📜",
          title: "Vault Notice",
          body: "Each gallery hides a national treasure behind its puzzle. Solve a gallery, pick up its treasure, and carry it here to the Time Capsule. Place all three to open the vault!",
        },
      ],
    },
  },
  {
    slug: "sg-culture",
    activitySlug: "escape-sg-culture",
    title: "The Festival Street Party",
    emoji: "🎉",
    tagline: "Fix the lights and unscramble the party words!",
    ageRange: "7–10",
    accent: "bg-bubble/15 text-bubble",
    ring: "ring-bubble/30",
    wall: "from-rose-100 via-amber-100 to-violet-100",
    floor: "from-amber-700 to-amber-900",
    pattern: "dots",
    floorKind: "wood",
    scene: "festival",
    character: "👧",
    intro:
      "Welcome to the Lion City Carnival! Visit the four festival stalls around the Grand Hall, then drag their words into the crossword. A secret animal reads down the gold column — spell it at the exit panel to open the gate!",
    outro: "You spell the Lion City's name and the carnival gate swings wide — drums, lights and cheers! 🦁🎉",
    // No special exit mechanism: solve the four stalls, the crossword and the
    // symbol lock, then walk out (mirrors the Android Big Hall).
    stations: [
      {
        id: "food",
        emoji: "🍜",
        label: "Hawker Stall",
        x: 50,
        y: 18,
        puzzle: {
          kind: "order",
          emoji: "🍜",
          prompt: "Cook a steaming bowl of laksa at the hawker stall. Put the steps in order:",
          items: [
            "Simmer the spicy coconut-milk broth",
            "Add the noodles, prawns and tofu puffs",
            "Top with cockles and serve hot",
          ],
          hint: "Broth first, then the noodles, then the toppings.",
          learn: "Laksa is a spicy coconut-milk noodle soup — a hawker favourite! 🍜",
        },
      },
      {
        id: "festival",
        emoji: "🪔",
        label: "Little India",
        x: 18,
        y: 50,
        puzzle: {
          // Android Big Hall: Little India — Unscramble (DIWALI).
          kind: "unscramble",
          emoji: "🪔",
          prompt: "Unscramble the Hindu festival of lights celebrated in Little India.",
          words: ["DIWALI"],
          clues: ["Oil lamps (diyas), colourful rangoli and sweets light up the festival of lights."],
          hint: "It starts with DI… and is the festival of lights.",
          learn: "Diwali is the festival of lights! 🪔 Row 2 of the crossword is DIWALI.",
        },
      },
      {
        id: "flower",
        emoji: "🌺",
        label: "Gardens",
        x: 82,
        y: 50,
        puzzle: {
          kind: "mcq",
          emoji: "🌺",
          prompt: "What is Singapore's national flower?",
          options: ["Orchid", "Rose", "Tulip"],
          answerIndex: 0,
          hint: "It's the Vanda 'Miss Joaquim' — a kind of this flower.",
          learn: "The orchid is Singapore's national flower! 🌺",
        },
      },
      {
        id: "fruit",
        emoji: "🥭",
        label: "Fruit Stall",
        x: 50,
        y: 82,
        puzzle: {
          kind: "cipher",
          emoji: "🔣",
          prompt: "Use the stall's symbol key to read the spiky 'king of fruits', then type it in.",
          symbols: ["🍴", "🥥", "🍢", "🍜", "🥭", "🦁", "🌺", "🏮", "🪔", "🧧", "🥮", "🎆"],
          letters: ["A", "D", "I", "L", "N", "O", "R", "S", "T", "U", "K", "C"],
          coded: ["🥥", "🧧", "🌺", "🍢", "🍴", "🥭"], // D U R I A N
          answer: "DURIAN",
          hint: "Find each symbol in the key and jot its letter — they're spread all over.",
          learn: "Durian is the spiky 'king of fruits'! 🥭",
        },
      },
      {
        id: "crossword",
        emoji: "🧩",
        label: "Grand Hall Crossword",
        x: 50,
        y: 50,
        puzzle: {
          kind: "crossword",
          emoji: "🧩",
          prompt: "Drag each carnival word into its numbered row. A secret animal reads down the gold column!",
          rows: [
            { num: 1, word: "LAKSA", offset: 5, clue: "Spicy coconut-milk noodle soup" },
            { num: 2, word: "DIWALI", offset: 4, clue: "Hindu festival of lights" },
            { num: 3, word: "ORCHID", offset: 5, clue: "Singapore's national flower" },
            { num: 4, word: "DURIAN", offset: 0, clue: "The spiky 'king of fruits'" },
          ],
          secretCol: 5,
          secret: "LION",
          hint: "Use the clues — each numbered row takes one word. The gold column spells a famous animal.",
          learn: "The gold column spells LION — Singapore is the Lion City! 🦁 Now spell it at the exit panel.",
        },
      },
      {
        id: "lockpad",
        emoji: "🔣",
        label: "Exit Panel",
        x: 82,
        y: 82,
        puzzle: {
          kind: "symbol-lock",
          emoji: "🔣",
          prompt: "Spell the crossword's secret word using the symbol key.",
          word: "LION",
          hint: "Read each letter's symbol from the key, then tap them in order: L · I · O · N.",
          learn: "L-I-O-N — you spelled the Lion City's name and the carnival gate opens! 🦁🎉",
        },
      },
    ],
    // A plus-shaped hub (Android Big Hall): the Grand Hall crossword sits in the
    // centre, the four stalls branch off it, and the Exit Panel hangs off the
    // Gardens. The crossword is locked until all four stalls are solved; the
    // exit panel until the crossword is done.
    layout: {
      cols: 3,
      rows: 3,
      cells: [
        { id: "hall", label: "Grand Hall", gx: 1, gy: 1, stationId: "crossword", role: "spawn", requiresAll: ["food", "festival", "flower", "fruit"] },
        { id: "food", label: "Hawker Stall", gx: 1, gy: 0, stationId: "food", role: "puzzle" },
        { id: "festival", label: "Little India", gx: 0, gy: 1, stationId: "festival", role: "puzzle" },
        { id: "flower", label: "Gardens", gx: 2, gy: 1, stationId: "flower", role: "puzzle" },
        { id: "fruit", label: "Fruit Stall", gx: 1, gy: 2, stationId: "fruit", role: "puzzle" },
        { id: "exit", label: "Exit Panel", gx: 2, gy: 2, stationId: "lockpad", role: "exit", requires: "crossword" },
      ],
      doors: [
        ["hall", "food"],
        ["hall", "festival"],
        ["hall", "flower"],
        ["hall", "fruit"],
        ["flower", "exit"],
      ],
      spawn: "hall",
      exit: "exit",
    },
  },
  {
    slug: "sg-nature",
    activitySlug: "escape-sg-nature",
    title: "The Garden City Trail",
    emoji: "🌳",
    tagline: "Find the trail words and read the map to escape!",
    ageRange: "8–11",
    accent: "bg-mint/15 text-emerald-600",
    ring: "ring-mint/30",
    wall: "from-sky-200 via-emerald-100 to-lime-100",
    floor: "from-amber-700 to-amber-900",
    pattern: "leaves",
    floorKind: "wood",
    scene: "nature",
    character: "👦",
    intro:
      "You're on the Garden City Trail when the park gate clicks shut! Explore the Lazy River and crack the ranger's code to light up the trail words — then read the ranger's note to work out the hidden one. Once you've read the whole map, walk the trail it shows to find the lost gate key — then carry it to the gate to unlock it and escape!",
    outro: "The gate opens to a chorus of birds and a wave from the otters — what a nature explorer! 🌳",
    stations: [
      {
        id: "river",
        emoji: "🦦",
        label: "Lazy River",
        x: 16,
        y: 30,
        // Lights up OTTER (as a 🦦 picture clue) on the trail map.
        provides: [{ kind: "word", to: "trailmap", word: "OTTER", emoji: "🦦" }],
        puzzle: {
          kind: "mcq",
          emoji: "🦦",
          prompt: "Which playful animal swims in Singapore's rivers in families?",
          options: ["Otters", "Penguins", "Polar bears"],
          answerIndex: 0,
          hint: "They're furry and love to splash together.",
          learn: "Singapore's smooth-coated otters live in families! 🦦 The word OTTER will light up on the trail map.",
        },
      },
      {
        id: "seed",
        emoji: "🥾",
        label: "The Trail",
        x: 44,
        y: 22,
        // The finale — no word clue. The Trail Map word search (trailmap) must be
        // solved first to reveal which order to walk the trail; until then the maze
        // stays locked.
        puzzle: {
          kind: "trailmaze",
          emoji: "🥾",
          unlockedBy: "trailmap",
          prompt: "Read the Trail Map first, then walk the trail in the order it shows to reach the lost gate key!",
          // 11×11 park-trail maze with real dead-ends; fog of war hides cells you
          // haven't explored, so you have to scout the trail to find each landmark.
          grid: [
            "###########",
            "#S..#....G#",
            "#.#.#.###.#",
            "#.#...#.#.#",
            "#.#####.#.#",
            "#.....#.#.#",
            "###.#.#.#.#",
            "#...#.#...#",
            "#.#####.###",
            "#.........#",
            "###########",
          ],
          landmarks: [
            { at: [9, 1], emoji: "🦦" },
            { at: [3, 7], emoji: "🌳" },
            { at: [7, 3], emoji: "🌊" },
          ],
          route: ["🦦", "🌳", "🌊"],
          goalEmoji: "🔑",
          caption: "Walk the map's order: 🦦 → 🌳 → 🌊 → grab the 🔑 gate key!",
          wonText: "🔑 You found the gate key! Pick it up and carry it to the Garden Gate.",
          hint: "Scout the trail through the fog — the map's order is 🦦, then 🌳, then 🌊. Reach the 🔑 key last.",
          learn: "You read the trail map and followed it to the lost gate key! 🔑 Now carry the key to the Garden Gate to unlock it and escape.",
        },
      },
      {
        id: "ranger",
        emoji: "🔣",
        label: "Ranger's Code",
        x: 72,
        y: 30,
        // Decodes RIVER and lights it up (as a 🌊 clue) on the trail map.
        provides: [{ kind: "word", to: "trailmap", word: "RIVER", emoji: "🌊" }],
        puzzle: {
          kind: "cipher",
          emoji: "🔣",
          prompt: "Use the ranger's nature key to read the secret place, then type it in.",
          // Substitution legend; the answer's symbols (R,I,V,E,R) are scattered
          // through the key, so you have to look each one up.
          symbols: ["🦋", "🌳", "🦦", "🌺", "🍃", "🐟", "🌊", "🦜", "🌱", "🐢", "🪺", "🌴", "🍄", "🐝"],
          letters: ["A", "T", "R", "O", "N", "I", "S", "V", "E", "L", "D", "G", "U", "H"],
          coded: ["🦦", "🐟", "🦜", "🌱", "🦦"], // R I V E R
          answer: "RIVER",
          hint: "Find each message symbol in the key and jot its letter — they're spread all over.",
          learn: "You cracked the ranger's code! 🌊 The word RIVER will light up on the trail map.",
        },
      },
      {
        id: "trailmap",
        emoji: "🗺️",
        label: "Trail Map",
        x: 42,
        y: 56,
        puzzle: {
          kind: "wordsearch",
          emoji: "🔎",
          prompt: "Two trail words light up when you solve the Lazy River and the Ranger's Code. The third stays hidden — read the ranger's note to work it out, then find all three!",
          words: ["OTTER", "GARDEN", "RIVER"],
          // GARDEN never lights up — it shows as ❓; the ranger's note hints it.
          secret: ["GARDEN"],
          // Deterministic grid: OTTER (→ row 4), GARDEN (↓ col 3) and RIVER (↘)
          // all cross at the E at row 4, col 3 — but reading the map now just tells
          // you the trail order; the gate is the maze, not a code.
          layout: [
            ["K", "X", "Q", "G", "H", "U", "F", "M"],
            ["R", "Z", "L", "A", "J", "W", "Y", "B"],
            ["C", "I", "K", "R", "X", "P", "U", "H"],
            ["M", "W", "V", "D", "Q", "Z", "J", "F"],
            ["O", "T", "T", "E", "R", "K", "Y", "C"],
            ["H", "U", "P", "N", "R", "W", "X", "Q"],
            ["D", "Z", "K", "J", "V", "C", "Y", "F"],
            ["P", "M", "H", "W", "Q", "U", "F", "Z"],
          ],
          hint: "The two lit-up words go across and slanted; the hidden one goes straight DOWN — the note tells you what it is.",
          learn: "OTTER, GARDEN and RIVER mark the trail on the map — now you know which way to walk it! 🗺️",
        },
      },
    ],
    // 4×2 with a wide Meadow hub. River + Ranger light up trail words; the Trail
    // Map word search reveals the maze's order; walking the maze (The Trail) drops
    // the gate key, which you carry to the Garden Gate to escape.
    layout: {
      cols: 4,
      rows: 2,
      cells: [
        { id: "start", label: "Trail Start", gx: 0, gy: 0, role: "spawn" },
        { id: "meadow", label: "Meadow", gx: 1, gy: 0, gw: 2 },
        { id: "exit", label: "Garden Gate", gx: 3, gy: 0, role: "exit" },
        { id: "river", label: "Lazy River", gx: 0, gy: 1, stationId: "river", role: "puzzle" },
        { id: "ranger", label: "Ranger's Code", gx: 1, gy: 1, stationId: "ranger", role: "puzzle" },
        { id: "seed", label: "The Trail", gx: 2, gy: 1, stationId: "seed", role: "puzzle" },
        { id: "trailmap", label: "Trail Map", gx: 3, gy: 1, stationId: "trailmap", role: "puzzle" },
      ],
      doors: [
        ["start", "meadow"],
        ["start", "river"],
        ["meadow", "ranger"],
        ["meadow", "seed"],
        ["seed", "trailmap"],
        ["trailmap", "exit"],
      ],
      spawn: "start",
      exit: "exit",
      // Walking The Trail (the maze) frees the gate key in that room; carry it to
      // the Garden Gate (the exit) and place it to unlock the door.
      carry: {
        mode: "direct",
        suitRoom: "exit",
        items: [{ id: "gate-key", emoji: "🔑", label: "Gate Key", icon: "key", station: "seed" }],
      },
      notes: [
        {
          id: "trail-note",
          room: "meadow",
          emoji: "📋",
          title: "Ranger's Note",
          body: "Solve the Lazy River and the Ranger's Code and two trail words light up on the map. The third stays hidden — here's the clue: Singapore is famous as a green ‘City’ full of parks and trees, a ______ City.",
        },
      ],
    },
  },
];

export function getEscapeRoom(slug: string): EscapeRoom | null {
  return ESCAPE_ROOMS.find((r) => r.slug === slug) ?? null;
}

/**
 * Build a square letter grid that contains every word, placed horizontally,
 * vertically or diagonally (forwards). Empty cells are filled with random
 * letters. Used by the word-search puzzle. Returns uppercase single letters.
 */
export function generateWordGrid(words: string[], size?: number): string[][] {
  const W = words.map((w) => w.toUpperCase().replace(/[^A-Z]/g, "")).filter(Boolean);
  const dim = Math.max(size ?? 0, 7, ...W.map((w) => w.length));
  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const dirs = [
    [0, 1], // →
    [1, 0], // ↓
    [1, 1], // ↘
  ];

  for (let attempt = 0; attempt < 250; attempt++) {
    const grid: (string | null)[][] = Array.from({ length: dim }, () =>
      Array<string | null>(dim).fill(null),
    );
    let allPlaced = true;

    for (const word of W) {
      let placed = false;
      for (let t = 0; t < 120 && !placed; t++) {
        const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
        const r0 = Math.floor(Math.random() * (dim - (dr ? word.length - 1 : 0)));
        const c0 = Math.floor(Math.random() * (dim - (dc ? word.length - 1 : 0)));
        let fits = true;
        for (let i = 0; i < word.length; i++) {
          const cur = grid[r0 + dr * i][c0 + dc * i];
          if (cur !== null && cur !== word[i]) {
            fits = false;
            break;
          }
        }
        if (!fits) continue;
        for (let i = 0; i < word.length; i++) grid[r0 + dr * i][c0 + dc * i] = word[i];
        placed = true;
      }
      if (!placed) {
        allPlaced = false;
        break;
      }
    }

    if (allPlaced) {
      return grid.map((row) => row.map((ch) => ch ?? ALPHA[Math.floor(Math.random() * 26)]));
    }
  }

  // Fallback: stack the words in rows and pad with random letters.
  const ALPHA2 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length: dim }, (_, r) => {
    const base = (W[r] ?? "") + ALPHA2.repeat(dim);
    return base.slice(0, dim).split("");
  });
}
