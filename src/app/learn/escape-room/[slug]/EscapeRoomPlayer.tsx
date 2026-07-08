"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  generateWordGrid,
  type Dir,
  type EscapeRoom,
  type EscapeRoomPuzzle,
  type RoomCipherExit,
  type RoomNote,
  type RoomUnscrambleExit,
  type Station,
} from "@/lib/escape-rooms";
import type { SessionStateDTO, PlayerDTO } from "@/lib/escape-session";
import { buildGeometry, roomAt, centerOf, moveWithCollision, type Point, type Rect } from "@/lib/escape-geometry";

const POINTS_FIRST_TRY = 10;
const POINTS_WITH_HELP = 6;
const POLL_MS = 1300;

type Mode = null | "solo" | "coop";

export function EscapeRoomPlayer({ room }: { room: EscapeRoom }) {
  const [mode, setMode] = useState<Mode>(null);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-fun text-sm font-600">
        <Link href="/learn" className="text-slate-400 hover:text-coral">
          ← Back to activities
        </Link>
        <span aria-hidden className="text-slate-300">
          ·
        </span>
        <Link href="/learn/escape-room" className="text-slate-400 hover:text-coral">
          🗝️ All escape rooms
        </Link>
      </div>

      {/* Room header */}
      <div className={`mt-3 flex items-center gap-4 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ${room.ring}`}>
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl ${room.accent}`}>
          {room.emoji}
        </div>
        <div className="min-w-0">
          <h1 className="font-fun text-2xl font-700 text-slate-900">{room.title}</h1>
          <p className="truncate font-round text-sm text-slate-500">{room.tagline}</p>
        </div>
      </div>

      {mode === null && <ModeSelect room={room} onPick={setMode} />}
      {mode === "solo" && <SoloRoom room={room} />}
      {mode === "coop" && <CoopRoom room={room} onLeave={() => setMode(null)} />}
    </div>
  );
}

/** Entry screen: read the story, then play solo or with friends. */
function ModeSelect({ room, onPick }: { room: EscapeRoom; onPick: (m: Mode) => void }) {
  return (
    <div className="mt-4 rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-amber-100">
      <div className="text-6xl">{room.character}</div>
      <p className="mx-auto mt-4 max-w-md font-round text-slate-600">{room.intro}</p>
      <p className="mt-3 font-fun text-sm font-600 text-slate-400">
        {room.stations.length} objects to solve · ages {room.ageRange}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          onClick={() => onPick("solo")}
          className="rounded-full bg-coral px-8 py-3 font-fun text-lg font-700 text-white shadow-lg transition hover:scale-105"
        >
          Play solo ▶
        </button>
        <button
          onClick={() => onPick("coop")}
          className="rounded-full bg-grape px-8 py-3 font-fun text-lg font-700 text-white shadow-lg transition hover:scale-105"
        >
          Play with friends 👫
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Solo                                                                */
/* ------------------------------------------------------------------ */

function SoloRoom({ room }: { room: EscapeRoom }) {
  const total = room.stations.length;
  const [solvedIds, setSolvedIds] = useState<string[]>([]);
  const [points, setPoints] = useState(0);
  const [escaped, setEscaped] = useState(false);
  const [savedScore, setSavedScore] = useState<number | null>(null);

  function onSolve(id: string, firstTry: boolean) {
    setSolvedIds((s) => (s.includes(id) ? s : [...s, id]));
    setPoints((p) => p + (firstTry ? POINTS_FIRST_TRY : POINTS_WITH_HELP));
  }

  useEffect(() => {
    if (!escaped) return;
    const score = Math.round((points / (total * POINTS_FIRST_TRY)) * 100);
    let cancelled = false;
    fetch("/api/learn/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activitySlug: room.activitySlug, score, metadata: { room: room.slug, stations: total } }),
    })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSavedScore(score);
      });
    return () => {
      cancelled = true;
    };
  }, [escaped, points, total, room.activitySlug, room.slug]);

  if (escaped) {
    return (
      <EscapedCard
        room={room}
        score={savedScore}
        onReplay={() => {
          setSolvedIds([]);
          setPoints(0);
          setSavedScore(null);
          setEscaped(false);
        }}
      />
    );
  }

  return <RoomMap room={room} solvedIds={solvedIds} onSolve={onSolve} onEscape={() => setEscaped(true)} />;
}

/* ------------------------------------------------------------------ */
/* Co-op (multiplayer)                                                 */
/* ------------------------------------------------------------------ */

async function api<T = { state: SessionStateDTO }>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Something went wrong");
  return data as T;
}

function CoopRoom({ room, onLeave }: { room: EscapeRoom; onLeave: () => void }) {
  const [stage, setStage] = useState<"choose" | "session">("choose");
  const [code, setCode] = useState<string | null>(null);
  const [st, setSt] = useState<SessionStateDTO | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const atStationRef = useRef<string | null>(null);

  async function host() {
    setBusy(true);
    setErr(null);
    try {
      const d = await api<{ code: string; state: SessionStateDTO }>("/api/learn/escape/create", { roomSlug: room.slug });
      setCode(d.code);
      setSt(d.state);
      setStage("session");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!joinCode.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const d = await api<{ code: string; state: SessionStateDTO }>("/api/learn/escape/join", {
        code: joinCode.trim(),
        roomSlug: room.slug,
      });
      setCode(d.code);
      setSt(d.state);
      setStage("session");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function startGame() {
    if (!code) return;
    try {
      const d = await api("/api/learn/escape/start", { code });
      setSt(d.state);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  // Poll loop: heartbeat + presence + shared state. Stops once escaped.
  useEffect(() => {
    if (stage !== "session" || !code) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      if (stopped) return;
      try {
        const d = await api("/api/learn/escape/sync", { code, atStation: atStationRef.current });
        if (!stopped) {
          setSt(d.state);
          if (d.state.status === "escaped") {
            stopped = true;
            return;
          }
        }
      } catch {
        /* transient — keep polling */
      }
      if (!stopped) timer = setTimeout(loop, POLL_MS);
    };
    loop();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [stage, code]);

  async function onSolve(stationId: string, firstTry: boolean) {
    setSt((s) => (s ? { ...s, solved: s.solved.includes(stationId) ? s.solved : [...s.solved, stationId] } : s));
    try {
      const d = await api("/api/learn/escape/solve", { code, stationId, firstTry });
      setSt(d.state);
    } catch {
      /* the poll will reconcile */
    }
  }

  async function onEscape() {
    try {
      const d = await api("/api/learn/escape/finish", { code });
      setSt(d.state);
    } catch {
      /* ignore */
    }
  }

  function onPresence(atStation: string | null) {
    atStationRef.current = atStation;
    if (!code) return;
    api("/api/learn/escape/sync", { code, atStation })
      .then((d) => setSt(d.state))
      .catch(() => {});
  }

  // --- Choose: host or join ---
  if (stage === "choose") {
    return (
      <div className="mt-4 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-amber-100">
        <h2 className="text-center font-fun text-2xl font-700 text-slate-900">Play with friends 👫</h2>
        <p className="mt-1 text-center font-round text-slate-500">
          Start a new room and share the code, or type a friend&apos;s code to join.
        </p>
        {err && <p className="mt-3 text-center font-fun text-sm font-700 text-coral">{err}</p>}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <button
            onClick={host}
            disabled={busy}
            className="flex flex-col items-center gap-2 rounded-3xl bg-grape/10 p-6 ring-1 ring-grape/30 transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
          >
            <span className="text-4xl">🚪</span>
            <span className="font-fun text-lg font-700 text-grape">Start a room</span>
            <span className="font-round text-xs text-slate-500">Get a code to share</span>
          </button>
          <div className="flex flex-col items-center gap-2 rounded-3xl bg-sky/10 p-6 ring-1 ring-sky/30">
            <span className="text-4xl">🔑</span>
            <span className="font-fun text-lg font-700 text-sky-600">Join a room</span>
            <div className="mt-1 flex w-full gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && join()}
                placeholder="CODE"
                aria-label="Room code"
                maxLength={12}
                className="w-full rounded-full border-2 border-sky-200 px-4 py-2 text-center font-fun text-lg font-700 uppercase tracking-widest text-slate-800 outline-none focus:border-sky-400"
              />
              <button
                onClick={join}
                disabled={busy || !joinCode.trim()}
                className="rounded-full bg-sky-500 px-4 py-2 font-fun font-700 text-white shadow disabled:opacity-50"
              >
                Go
              </button>
            </div>
          </div>
        </div>
        <div className="mt-6 text-center">
          <button onClick={onLeave} className="font-fun text-sm font-600 text-slate-400 hover:text-coral">
            ← Play on my own instead
          </button>
        </div>
      </div>
    );
  }

  if (!st) {
    return <div className="mt-4 text-center font-fun text-slate-500">Loading the room… 🚪</div>;
  }

  // --- Lobby: waiting for the host to start ---
  if (st.status === "lobby") {
    const isHost = st.you === st.hostId;
    return (
      <div className="mt-4 rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-amber-100">
        <p className="font-fun text-sm font-600 text-slate-400">Room code — share it with your friends!</p>
        <div className="mt-2 inline-block rounded-2xl bg-slate-900 px-8 py-3 font-mono text-4xl font-700 tracking-[0.3em] text-mint">
          {st.code}
        </div>
        <PlayerStrip room={room} players={st.players} youId={st.you} />
        <div className="mt-6">
          {isHost ? (
            <button
              onClick={startGame}
              className="rounded-full bg-coral px-8 py-3 font-fun text-lg font-700 text-white shadow-lg transition hover:scale-105"
            >
              Start the escape! 🚀
            </button>
          ) : (
            <p className="font-round text-slate-500">Waiting for the host to start… ⏳</p>
          )}
        </div>
        <div className="mt-5">
          <button onClick={onLeave} className="font-fun text-sm font-600 text-slate-400 hover:text-coral">
            ← Leave room
          </button>
        </div>
      </div>
    );
  }

  // --- Escaped: team result ---
  if (st.status === "escaped") {
    const score = st.total ? Math.round((st.points / (st.total * POINTS_FIRST_TRY)) * 100) : 0;
    return (
      <div className="mt-4 rounded-[2rem] bg-white p-10 text-center shadow-sm ring-1 ring-amber-100">
        <div className="text-7xl">🎉</div>
        <h2 className="mt-3 font-fun text-3xl font-700 text-slate-900">Your team escaped!</h2>
        <p className="mx-auto mt-2 max-w-md font-round text-slate-500">{room.outro}</p>
        <div className="mt-4 inline-block rounded-full bg-mint/20 px-5 py-1.5 font-fun font-700 text-emerald-600">
          +{score} points each!
        </div>
        <PlayerStrip room={room} players={st.players} youId={st.you} />
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button onClick={onLeave} className="rounded-full bg-coral px-6 py-3 font-fun font-700 text-white shadow">
            Back to start 🔁
          </button>
          <Link href="/learn" className="rounded-full bg-slate-100 px-6 py-3 font-fun font-600 text-slate-600">
            All activities
          </Link>
        </div>
      </div>
    );
  }

  // --- Playing: the shared room scene ---
  const sceneProps = {
    room,
    solvedIds: st.solved,
    onSolve,
    onEscape,
    isCoop: true,
    others: st.players.filter((p) => p.learnerId !== st.you),
    onPresence,
  };
  return <RoomMap {...sceneProps} />;
}

/** A horizontal row of player avatars (lobby + results). */
function PlayerStrip({ room, players, youId }: { room: EscapeRoom; players: PlayerDTO[]; youId: number }) {
  return (
    <div className="mt-5 flex flex-wrap justify-center gap-3">
      {players.map((p) => {
        const isYou = p.learnerId === youId;
        return (
          <div
            key={p.learnerId}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 ring-1 ${
              isYou ? "bg-coral/15 ring-coral/40" : "bg-amber-50 ring-amber-100"
            }`}
          >
            <span className="text-2xl">{room.character}</span>
            <span className="font-fun text-sm font-700 text-slate-700">
              {isYou ? "You" : p.name.split(" ")[0]}
              {p.isHost && " 👑"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

type ScenePlayer = Pick<PlayerDTO, "learnerId" | "name" | "atStation">;

/* ------------------------------------------------------------------ */
/* RoomMap — navigable top-down rooms: walls, free movement, take/drop  */
/* ------------------------------------------------------------------ */

const MAP_CELL = 100; // units per grid cell
const CHAR_R = 11; // character collision radius (units) — ~matches the sprite so it
// sits close to walls (bigger = a visible gap; must stay well under a doorway's width)
const MAP_SPEED = 150; // units / second (a cell is 100 units → ~0.7s to cross)
const REACH = 58; // interaction range (units)

type MapInteractable = {
  key: string;
  kind: "machine" | "note" | "item" | "charge" | "wash" | "deliver" | "exit";
  id: string;
  label: string;
  x: number;
  y: number;
  enabled?: boolean;
};

function RoomMap({
  room,
  solvedIds,
  onSolve,
  onEscape,
  isCoop = false,
  others = [],
  onPresence,
}: {
  room: EscapeRoom;
  solvedIds: string[];
  onSolve: (stationId: string, firstTry: boolean) => void;
  onEscape: () => void;
  isCoop?: boolean;
  others?: ScenePlayer[];
  onPresence?: (atStation: string | null) => void;
}) {
  const layout = room.layout;
  const geo = useMemo(
    () =>
      buildGeometry(
        layout,
        { w: layout.cols * MAP_CELL, h: layout.rows * MAP_CELL },
        { wall: 8, doorFrac: 0.6 },
      ),
    [layout],
  );
  const W = geo.area.w;
  const H = geo.area.h;
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  // Solid decor (every prop except the ceiling cables, which use w/h) gets a
  // collision box so the player bumps into racks / robots / crates instead of
  // walking through them. Boxes are a touch smaller than the sprite so edges
  // feel forgiving; merged with the room walls for the movement loop.
  const collisionWalls = useMemo<Rect[]>(() => {
    const rects: Rect[] = [...geo.walls];
    const sp = geo.spawn;
    for (const d of layout.decor ?? []) {
      if (d.w != null && d.h != null) continue; // ceiling cables — walk under
      const r = geo.floors[d.room];
      if (!r) continue;
      const s = d.scale ?? 1;
      // Small base-footprint box (much smaller than the sprite) so the ~15-unit
      // player radius doesn't create a big stand-off; you bump the prop's base,
      // and can brush past its taller upper half.
      const hw = 5 * s;
      const hh = 4 * s;
      const box = { x: r.x + r.w * d.x - hw, y: r.y + r.h * d.y - hh, w: hw * 2, h: hh * 2 };
      // Never box in the spawn point: if the player would start inside this box
      // (grown by its radius), skip it so they can't be trapped on entry.
      if (
        sp.x > box.x - CHAR_R &&
        sp.x < box.x + box.w + CHAR_R &&
        sp.y > box.y - CHAR_R &&
        sp.y < box.y + box.h + CHAR_R
      )
        continue;
      rects.push(box);
    }
    return rects;
  }, [geo, layout.decor]);

  // ---- puzzle modal + progress ----
  const [openId, setOpenId] = useState<string | null>(null);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [doorOpen, setDoorOpen] = useState(false);
  const [coresDone, setCoresDone] = useState<number[]>([]);
  const [wrongCount, setWrongCount] = useState(0);
  const [hintShown, setHintShown] = useState(false);
  const [justSolved, setJustSolved] = useState(false);

  // ---- carry mechanic (cores / artefacts / bottles) — mirrors the Android
  // doAction() state machine: pick up → charge/wash → deliver, set down to swap.
  const carry = layout.carry ?? null;
  const carryItems = carry?.items ?? [];
  const [carrying, setCarrying] = useState<string | null>(null);
  const [carriedReady, setCarriedReady] = useState(false); // charged core / washed bottle in hand
  const [charged, setCharged] = useState<string[]>([]); // cores charged & resting at their station
  const [washed, setWashed] = useState<string[]>([]); // bottles washed & set down (still to recycle)
  const [delivered, setDelivered] = useState<string[]>([]); // cores/artefacts delivered, bottles recycled
  const [drops, setDrops] = useState<Record<string, Point>>({}); // item id → where it was set down
  const [flash, setFlash] = useState<string | null>(null); // transient hint ("Locked…", "Set down")

  // ---- live navigation ----
  const [near, setNear] = useState<MapInteractable | null>(null);
  // Fog of war — only the room you're currently in is lit; every other room
  // stays fully dark + opaque, whether or not you've been there before.
  const [curRoom, setCurRoom] = useState(layout.spawn);
  // Touch devices have no keyboard — show an on-screen D-pad instead. Detected
  // once on mount (coarse pointer = finger/stylus as the primary input).
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    setTouch(typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches);
  }, []);

  const total = room.stations.length;
  const allSolved = solvedIds.length >= total;
  const deliveredAll = carryItems.length === 0 || delivered.length >= carryItems.length;
  // Recycling: every bottle recycled unlocks the gated circuit room.
  const bottlesDone = carry?.mode === "recycle" && deliveredAll;
  // The exit waits on charge/direct carries directly; recycle carries gate the
  // circuit room's puzzle instead (solving it already feeds the exit).
  const exitReady = allSolved && (carry?.mode === "recycle" || deliveredAll);

  const openStation = room.stations.find((s) => s.id === openId) ?? null;
  const reviewing = !!openStation && solvedIds.includes(openStation.id) && !justSolved;
  const lockPuzzle = justSolved || reviewing;
  const orderUnlocked =
    openStation?.puzzle.kind !== "trailmaze" ||
    !openStation.puzzle.unlockedBy ||
    solvedIds.includes(openStation.puzzle.unlockedBy);
  const noteData = layout.notes?.find((n) => n.id === openNote) ?? null;
  const labelOf = (id: string | null) => carryItems.find((i) => i.id === id)?.label ?? "item";

  // Charge-mode cores carry a matching number (the only distinguisher while
  // loose); each charger room shows the number of the core it wants.
  const coreNumber = (id: string | null): number | null => {
    if (carry?.mode !== "charge" || id == null) return null;
    const idx = carry.items.findIndex((it) => it.id === id);
    return idx >= 0 ? idx + 1 : null;
  };

  // --- carry-mechanic anchors (suit/sink/recycler/station positions) ---
  const cellForStation = (sid: string) => layout.cells.find((c) => c.stationId === sid);
  // Where a room's machine stands — its authored mx/my offset (0–1 of the room),
  // defaulting to the centre. Used by the render, proximity list and carry anchors
  // alike so the machine, its hit target and its charge point all stay aligned.
  const machineAt = (cell: (typeof layout.cells)[number]): Point => {
    const r = geo.floors[cell.id];
    return { x: r.x + r.w * (cell.mx ?? 0.5), y: r.y + r.h * (cell.my ?? 0.5) };
  };
  const machinePos = (sid: string): Point | null => {
    const cell = cellForStation(sid);
    return cell && geo.floors[cell.id] ? machineAt(cell) : null;
  };
  const suitRoomId = carry && carry.mode !== "recycle" ? carry.suitRoom : null;
  const suitFloor = suitRoomId ? geo.floors[suitRoomId] : null;
  const suitPt = suitFloor ? centerOf(suitFloor) : null;
  const sinkFloor = carry?.mode === "recycle" ? geo.floors[carry.sinkRoom] : null;
  const depositFloor = carry?.mode === "recycle" ? geo.floors[carry.depositRoom] : null;
  const sinkPt = sinkFloor ? { x: sinkFloor.x + sinkFloor.w * 0.26, y: sinkFloor.y + sinkFloor.h * 0.82 } : null;
  const depositPt = depositFloor ? { x: depositFloor.x + depositFloor.w * 0.76, y: depositFloor.y + depositFloor.h * 0.82 } : null;

  // Where an item rests right now (home / charged-at-station / set-down / delivered).
  const itemHome = (it: typeof carryItems[number], i: number): Point => {
    if (carry?.mode === "charge") {
      // Line the (identical-looking) cores up left-to-right so their order
      // matches the row of numbered cores drawn in the note (kept below the pin).
      const r = geo.floors[carry.coreRoom];
      return { x: r.x + r.w * (0.24 + 0.26 * i), y: r.y + r.h * 0.62 };
    }
    if (carry?.mode === "direct") {
      const cell = it.station ? cellForStation(it.station) : null;
      const r = (cell && geo.floors[cell.id]) || geo.floors[layout.spawn];
      return { x: r.x + r.w * 0.3, y: r.y + r.h * 0.3 };
    }
    // Bottles rest near the top of their room, clear of the centred machine and
    // the bottom-corner sink/recycler.
    const r = geo.floors[it.home ?? layout.spawn];
    return { x: r.x + r.w * (0.32 + 0.18 * (i % 3)), y: r.y + r.h * 0.24 };
  };
  const itemPos = (it: typeof carryItems[number], i: number): Point => {
    if (delivered.includes(it.id)) {
      if (carry?.mode === "recycle" && depositPt) return { x: depositPt.x + (i - 1) * 16, y: depositPt.y - 18 };
      if (suitPt) return { x: suitPt.x + (i - 1) * 18, y: suitPt.y + 20 };
    }
    if (drops[it.id]) return drops[it.id];
    if (carry?.mode === "charge" && charged.includes(it.id) && it.station) {
      const m = machinePos(it.station);
      if (m) return { x: m.x, y: m.y - 24 };
    }
    return itemHome(it, i);
  };
  // Can the player pick this item up (loose, not carried, not delivered; an
  // artefact only once its gallery is solved)?
  const isPickable = (it: typeof carryItems[number]) =>
    !carrying &&
    !delivered.includes(it.id) &&
    !(carry?.mode === "direct" && it.station != null && !solvedIds.includes(it.station));

  // A machine is locked until its prerequisites are met (recycle gate, or a
  // `requires`/`requiresAll` chain like the crossword → symbol-lock).
  const cellLocked = (cell: typeof layout.cells[number]): boolean => {
    if (carry?.mode === "recycle" && carry.gateRoom === cell.id && !bottlesDone) return true;
    if (cell.requires && !solvedIds.includes(cell.requires)) return true;
    if (cell.requiresAll?.some((id) => !solvedIds.includes(id))) return true;
    return false;
  };
  const lockMessage = (cell: typeof layout.cells[number]): string =>
    carry?.mode === "recycle" && carry.gateRoom === cell.id && !bottlesDone
      ? "Locked — recycle all the bottles first"
      : "Locked — solve the other rooms first";

  // exit mechanism
  const codeSlots = useMemo(() => {
    for (const s of room.stations) {
      if (s.puzzle.kind === "wordsearch" && s.puzzle.intersection) {
        const [r, c] = s.puzzle.intersection;
        return [
          { value: String(r + 1) },
          { value: String(c + 1) },
        ];
      }
    }
    return [];
  }, [room.stations]);
  const usesCodeExit = codeSlots.length > 0;
  const exitCode = codeSlots.map((d) => d.value).join("");
  const cipherExit = room.exit?.kind === "cipher" ? room.exit : null;
  const unscrambleExit = room.exit?.kind === "unscramble" ? room.exit : null;

  const norm = (w: string) => w.toUpperCase().replace(/[^A-Z]/g, "");
  const { hiddenWords, wordHints } = useMemo(() => {
    const hidden = new Set<string>();
    const hints = new Map<string, string>();
    if (openStation?.puzzle.kind !== "wordsearch") return { hiddenWords: hidden, wordHints: hints };
    const providerOf = new Map<string, { id: string; emoji: string }>();
    for (const s of room.stations) {
      for (const clue of s.provides ?? []) {
        if (clue.kind === "word" && clue.to === openStation.id) {
          providerOf.set(norm(clue.word), { id: s.id, emoji: clue.emoji });
        }
      }
    }
    for (const w of openStation.puzzle.words) {
      const provider = providerOf.get(norm(w));
      if (!provider) continue;
      hints.set(norm(w), provider.emoji);
      if (!solvedIds.includes(provider.id)) hidden.add(norm(w));
    }
    return { hiddenWords: hidden, wordHints: hints };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openStation, room.stations, solvedIds]);

  useEffect(() => {
    setWrongCount(0);
    setHintShown(false);
    setJustSolved(false);
  }, [openId]);

  // ---- interactables (one contextual action, mirroring doAction) ----
  const interactables = useMemo<MapInteractable[]>(() => {
    const list: MapInteractable[] = [];

    // While carrying, the only action is the contextual carry step (charge / wash
    // / deliver) — set-down is the action-button fallback when none is in reach.
    if (carrying) {
      const held = carryItems.find((i) => i.id === carrying);
      if (held) {
        if (carry?.mode === "charge") {
          if (!carriedReady && held.station) {
            const m = machinePos(held.station);
            if (m) list.push({ key: "charge", kind: "charge", id: held.station, label: `Charge ${held.label}`, x: m.x, y: m.y, enabled: solvedIds.includes(held.station) });
          } else if (carriedReady && suitPt) {
            list.push({ key: "deliver", kind: "deliver", id: suitRoomId!, label: "Power the suit", x: suitPt.x, y: suitPt.y });
          }
        } else if (carry?.mode === "direct" && suitPt) {
          list.push({ key: "deliver", kind: "deliver", id: suitRoomId!, label: `Place ${held.label}`, x: suitPt.x, y: suitPt.y });
        } else if (carry?.mode === "recycle") {
          if (!carriedReady && sinkPt) list.push({ key: "wash", kind: "wash", id: "sink", label: `Wash ${held.label}`, x: sinkPt.x, y: sinkPt.y });
          else if (carriedReady && depositPt) list.push({ key: "deposit", kind: "deliver", id: "recycler", label: `Recycle ${held.label}`, x: depositPt.x, y: depositPt.y });
        }
      }
      return list;
    }

    // Empty-handed — machines, notes, loose items, exit.
    for (const cell of layout.cells) {
      if (!cell.stationId) continue;
      const c = machineAt(cell);
      const gated = cellLocked(cell);
      list.push({
        key: `m-${cell.id}`,
        kind: "machine",
        id: cell.stationId,
        label: gated ? "Locked" : solvedIds.includes(cell.stationId) ? "Review" : "Open",
        x: c.x,
        y: c.y,
      });
    }
    for (const n of layout.notes ?? []) {
      const r = geo.floors[n.room];
      if (!r) continue;
      list.push({ key: `n-${n.id}`, kind: "note", id: n.id, label: "Read", x: r.x + r.w / 2, y: r.y + r.h * 0.3 });
    }
    carryItems.forEach((it, i) => {
      if (!isPickable(it)) return;
      const p = itemPos(it, i);
      list.push({ key: `i-${it.id}`, kind: "item", id: it.id, label: `Take ${it.label}`, x: p.x, y: p.y });
    });
    const er = geo.floors[layout.exit];
    if (er) {
      const c = centerOf(er);
      list.push({ key: "exit", kind: "exit", id: layout.exit, label: "Open the door", x: c.x, y: c.y + 22, enabled: exitReady });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, layout, solvedIds, carry, carrying, carriedReady, charged, delivered, drops, bottlesDone, exitReady]);

  // ---- refs for the animation/input loop (avoid 60fps re-renders) ----
  const posRef = useRef<Point>({ ...geo.spawn });
  const charRef = useRef<HTMLDivElement | null>(null);
  const velRef = useRef({ x: 0, y: 0 });
  const nearKeyRef = useRef<string | null>(null);
  const curRoomRef = useRef(layout.spawn);
  const onPresenceRef = useRef(onPresence);
  const interRef = useRef(interactables);
  const modalRef = useRef(false);
  const actionRef = useRef<(n: MapInteractable | null) => void>(() => {});
  const wallsRef = useRef<Rect[]>(collisionWalls);
  onPresenceRef.current = onPresence;
  interRef.current = interactables;
  modalRef.current = !!(openId || openNote || doorOpen);
  wallsRef.current = collisionWalls;

  // movement + proximity loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      if (!modalRef.current) {
        const v = velRef.current;
        if (v.x || v.y) {
          const mag = Math.hypot(v.x, v.y) || 1;
          const sp = Math.min(mag, 1) * MAP_SPEED * dt;
          const np = moveWithCollision(posRef.current, (v.x / mag) * sp, (v.y / mag) * sp, CHAR_R, wallsRef.current, geo.area);
          posRef.current = np;
          if (charRef.current) {
            charRef.current.style.left = pct(np.x, W);
            charRef.current.style.top = pct(np.y, H);
          }
          const rm = roomAt(geo, np);
          if (rm && rm !== curRoomRef.current) {
            curRoomRef.current = rm;
            onPresenceRef.current?.(rm);
            setCurRoom(rm);
          }
        }
        // nearest enabled interactable (every frame, even when standing still)
        let best: MapInteractable | null = null;
        let bestD = REACH;
        for (const it of interRef.current) {
          if (it.enabled === false) continue;
          const d = Math.hypot(it.x - posRef.current.x, it.y - posRef.current.y);
          if (d < bestD) {
            bestD = d;
            best = it;
          }
        }
        if ((best?.key ?? null) !== nearKeyRef.current) {
          nearKeyRef.current = best?.key ?? null;
          setNear(best);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo]);

  // keyboard movement
  useEffect(() => {
    const down = new Set<string>();
    const recompute = () => {
      velRef.current = {
        x: (down.has("ArrowRight") || down.has("d") ? 1 : 0) - (down.has("ArrowLeft") || down.has("a") ? 1 : 0),
        y: (down.has("ArrowDown") || down.has("s") ? 1 : 0) - (down.has("ArrowUp") || down.has("w") ? 1 : 0),
      };
    };
    const isMove = (k: string) => ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(k);
    const onDown = (e: KeyboardEvent) => {
      if (modalRef.current) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        const it = nearKeyRef.current ? interRef.current.find((i) => i.key === nearKeyRef.current) ?? null : null;
        // No target in reach still fires the action (carry → set down).
        actionRef.current(it);
        return;
      }
      if (isMove(e.key)) {
        e.preventDefault();
        down.add(e.key);
        recompute();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (isMove(e.key)) {
        down.delete(e.key);
        recompute();
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickUp(id: string) {
    setCarrying(id);
    // A core picked back up from its station is already charged; a washed bottle
    // picked back up is still clean.
    setCarriedReady(carry?.mode === "charge" ? charged.includes(id) : carry?.mode === "recycle" ? washed.includes(id) : false);
    setCharged((c) => c.filter((x) => x !== id));
    setWashed((w) => w.filter((x) => x !== id));
    setDrops((d) => {
      if (!(id in d)) return d;
      const next = { ...d };
      delete next[id];
      return next;
    });
  }

  /** Set the carried item down where you stand (so you can swap it). */
  function setDown() {
    if (!carrying) return;
    const id = carrying;
    setDrops((d) => ({ ...d, [id]: { x: posRef.current.x, y: posRef.current.y } }));
    if (carriedReady && carry?.mode === "charge") setCharged((c) => (c.includes(id) ? c : [...c, id]));
    if (carriedReady && carry?.mode === "recycle") setWashed((w) => (w.includes(id) ? w : [...w, id]));
    setCarrying(null);
    setCarriedReady(false);
  }

  function performAction(n: MapInteractable | null) {
    // No target in reach while carrying → drop the item where you stand.
    if (!n) {
      if (carrying) setDown();
      return;
    }
    if (n.enabled === false) {
      if (n.kind === "charge") setFlash("Solve this charger first!");
      return;
    }
    switch (n.kind) {
      case "machine": {
        const cell = cellForStation(n.id);
        if (cell && cellLocked(cell)) {
          setFlash(lockMessage(cell));
          return;
        }
        setOpenId(n.id);
        break;
      }
      case "note":
        setOpenNote(n.id);
        break;
      case "item":
        pickUp(n.id);
        break;
      case "charge":
        if (carrying) {
          const id = carrying;
          setCharged((c) => (c.includes(id) ? c : [...c, id]));
          setCarrying(null);
          setCarriedReady(false);
          setFlash("Core charged! ⚡");
        }
        break;
      case "wash":
        setCarriedReady(true);
        setFlash("Bottle washed — now recycle it! ✨");
        break;
      case "deliver":
        if (carrying) {
          const id = carrying;
          setDelivered((d) => (d.includes(id) ? d : [...d, id]));
          setCarrying(null);
          setCarriedReady(false);
        }
        break;
      case "exit":
        if (usesCodeExit || cipherExit || unscrambleExit) setDoorOpen(true);
        else onEscape();
        break;
    }
  }

  actionRef.current = performAction;

  // Auto-dismiss the transient carry hint.
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  function closeModal() {
    setOpenId(null);
  }
  function handleSolved() {
    if (justSolved || !openStation) return;
    setJustSolved(true);
    onSolve(openStation.id, wrongCount === 0 && !hintShown);
  }


  const heldItem = carryItems.find((i) => i.id === carrying) ?? null;
  const spawnCenter = geo.spawn;

  // Hold-to-move for the on-screen D-pad: writes the same velocity ref the
  // keyboard loop reads, so touch walking runs through the identical movement +
  // collision path. Pointer capture keeps the press alive if the finger slides
  // off the button; up/cancel/leave all stop the character.
  const worldDpad =
    "flex h-12 w-12 touch-none items-center justify-center rounded-xl bg-white/85 text-2xl shadow-md ring-1 ring-slate-200 backdrop-blur transition active:scale-95 active:bg-coral/20";
  const holdDir = (vx: number, vy: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      velRef.current = { x: vx, y: vy };
    },
    onPointerUp: () => {
      velRef.current = { x: 0, y: 0 };
    },
    onPointerCancel: () => {
      velRef.current = { x: 0, y: 0 };
    },
  });

  return (
    <>
      <div
        className={`relative mx-auto mt-4 overflow-hidden rounded-[2rem] bg-gradient-to-br ${room.floor} shadow-sm ring-1 ${room.ring}`}
        style={{
          aspectRatio: `${layout.cols} / ${layout.rows}`,
          // Fit within the column width AND ~62% of the viewport height, keeping
          // the room's aspect ratio — so even tall maps never need scrolling.
          width: `min(100%, calc(62vh * ${layout.cols / layout.rows}))`,
        }}
      >
        {/* Floor rooms */}
        {layout.cells.map((cell) => {
          const r = geo.floors[cell.id];
          return (
            <div
              key={cell.id}
              className={`absolute z-0 rounded-lg bg-gradient-to-br ${room.wall} opacity-90`}
              style={{ left: pct(r.x, W), top: pct(r.y, H), width: pct(r.w, W), height: pct(r.h, H) }}
            />
          );
        })}

        {/* Cosmetic decor — drawn above the floor but below machines (z-20) and
            below fog (z-25), so it only shows in the lit room and never blocks
            interaction (pointer-events-none, not in `interactables`). */}
        {(layout.decor ?? []).map((d, i) => {
          const r = geo.floors[d.room];
          if (!r) return null;
          const left = pct(r.x + r.w * d.x, W);
          const top = pct(r.y + r.h * d.y, H);
          // Explicit w/h → a stretched run (e.g. a cable). Treated as a ceiling
          // fixture: in the room you're in it hangs ABOVE the player (z-45 >
          // player z-40); in other rooms it drops below the fog (z-25) so the
          // fog-of-war still hides it.
          if (d.w != null && d.h != null) {
            return (
              <svg
                key={`decor-${i}`}
                aria-hidden
                viewBox="0 0 40 40"
                preserveAspectRatio="none"
                className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 ${
                  d.room === curRoom ? "z-[45]" : "z-10"
                }`}
                style={{ left, top, width: pct(r.w * d.w, W), height: pct(r.h * d.h, H) }}
              >
                {PROP_ART[d.art]}
              </svg>
            );
          }
          const s = d.scale ?? 1;
          return (
            <div
              key={`decor-${i}`}
              aria-hidden
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left, top }}
            >
              <Prop
                art={d.art}
                className="h-12 w-12 sm:h-14 sm:w-14"
                style={{
                  transform: `scale(${d.flip ? -s : s}, ${s})`,
                  filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.4))",
                }}
              />
            </div>
          );
        })}

        {/* Fog of war — every room except the one you're in is fully dark. */}
        {layout.cells.map((cell) => {
          if (cell.id === curRoom) return null;
          const r = geo.floors[cell.id];
          return (
            <div
              key={`fog-${cell.id}`}
              className="absolute z-[25] rounded-lg bg-slate-950 transition-colors duration-300"
              style={{ left: pct(r.x, W), top: pct(r.y, H), width: pct(r.w, W), height: pct(r.h, H) }}
            />
          );
        })}

        {/* Walls (above fog so the maze stays legible) */}
        {geo.walls.map((w, i) => (
          <div
            key={i}
            className="absolute z-30 rounded-[3px] bg-slate-900/85 shadow"
            style={{ left: pct(w.x, W), top: pct(w.y, H), width: pct(w.w, W), height: pct(w.h, H) }}
          />
        ))}

        {/* Room labels (above walls; only the room you're currently in) */}
        {layout.cells.map((cell) => {
          if (cell.id !== curRoom) return null;
          const r = geo.floors[cell.id];
          return (
            <span
              key={`lbl-${cell.id}`}
              className="absolute z-[35] -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900/55 px-2 py-0.5 font-fun text-[9px] font-700 text-white/80 sm:text-[11px]"
              style={{ left: pct(r.x + r.w / 2, W), top: pct(r.y + 6, H) }}
            >
              {cell.label}
            </span>
          );
        })}

        {/* Notes */}
        {(layout.notes ?? []).map((n) => {
          const r = geo.floors[n.room];
          if (!r) return null;
          const x = r.x + r.w / 2;
          const y = r.y + r.h * 0.3;
          const ringed = near?.key === `n-${n.id}`;
          return (
            <button
              key={n.id}
              onClick={() => setOpenNote(n.id)}
              className={`absolute z-20 h-8 w-8 -translate-x-1/2 -translate-y-1/2 transition sm:h-9 sm:w-9 ${ringed ? "scale-110" : ""}`}
              style={{
                left: pct(x, W),
                top: pct(y, H),
                filter: ringed
                  ? "drop-shadow(0 0 5px rgba(248,113,113,0.95)) drop-shadow(0 2px 2px rgba(0,0,0,0.3))"
                  : "drop-shadow(0 2px 2px rgba(0,0,0,0.3))",
              }}
              title="Read the note"
            >
              <Prop art="note" className="h-full w-full" />
            </button>
          );
        })}

        {/* Sink + recycler stations (recycle mode) */}
        {sinkPt && (
          <div
            className="absolute z-20 flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
            style={{ left: pct(sinkPt.x, W), top: pct(sinkPt.y, H) }}
            title="Wash sink"
          >
            <Prop art="sink" className="h-10 w-10 sm:h-12 sm:w-12" style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.35))" }} />
            <span className="-mt-1 rounded-full bg-slate-900/60 px-1.5 font-fun text-[8px] font-700 text-white sm:text-[10px]">Wash</span>
          </div>
        )}
        {depositPt && (
          <div
            className="absolute z-20 flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
            style={{ left: pct(depositPt.x, W), top: pct(depositPt.y, H) }}
            title="Recycler"
          >
            <Prop art="recycler" className="h-10 w-10 sm:h-12 sm:w-12" style={{ filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.35))" }} />
            <span className="-mt-1 rounded-full bg-slate-900/60 px-1.5 font-fun text-[8px] font-700 text-white sm:text-[10px]">Recycle</span>
          </div>
        )}

        {/* World items — loose / charged / set-down / delivered (carried one is
            drawn on the character). */}
        {carryItems.map((it, i) => {
          if (carrying === it.id) return null;
          const p = itemPos(it, i);
          const done = delivered.includes(it.id);
          const isCore = carry?.mode === "charge";
          const isBottle = carry?.mode === "recycle";
          const chargedCore = isCore && charged.includes(it.id);
          const dirtyBottle = isBottle && !washed.includes(it.id) && !done;
          const pickable = isPickable(it);
          const num = coreNumber(it.id);
          const ringed = near?.key === `i-${it.id}`;
          const propType = isBottle ? "bottle" : ITEM_PROP[it.icon ?? ""] ?? "scroll";
          return (
            <button
              key={it.id}
              onClick={() => pickable && pickUp(it.id)}
              disabled={!pickable}
              className={`absolute z-20 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center transition sm:h-10 sm:w-10 ${ringed ? "scale-110" : ""} ${pickable ? "" : "cursor-default"}`}
              style={{
                left: pct(p.x, W),
                top: pct(p.y, H),
                opacity: pickable || done ? 1 : 0.5,
                filter: `${dirtyBottle ? "grayscale(1) brightness(0.82) " : ""}${
                  ringed
                    ? "drop-shadow(0 0 5px rgba(248,113,113,0.95)) drop-shadow(0 2px 2px rgba(0,0,0,0.3))"
                    : "drop-shadow(0 2px 2px rgba(0,0,0,0.3))"
                }`,
              }}
              title={num ? `Core ${num}` : dirtyBottle ? `${it.label} (needs washing)` : done ? `${it.label} (done)` : it.label}
            >
              {isCore ? (
                <span
                  className="flex h-full w-full items-center justify-center rounded-full ring-2 ring-white/70"
                  style={{ background: chargedCore ? "radial-gradient(circle at 35% 30%, #fde68a, #f59e0b 55%, #b45309)" : "radial-gradient(circle at 35% 30%, #bae6fd, #38bdf8 55%, #075985)" }}
                >
                  {chargedCore && it.station && <StationIcon name={STATION_ICON[`${room.slug}:${it.station}`] ?? "core"} className="h-4 w-4 text-white sm:h-5 sm:w-5" />}
                </span>
              ) : (
                <Prop art={propType} className="h-full w-full" />
              )}
              {num != null && !done && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 font-fun text-[9px] font-700 text-white ring-1 ring-white/70 sm:h-5 sm:w-5 sm:text-[10px]">
                  {num}
                </span>
              )}
              {done && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-1 ring-white">
                  <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4 4L19 6.5" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}

        {/* Machines */}
        {layout.cells.map((cell) => {
          if (!cell.stationId) return null;
          const station = room.stations.find((s) => s.id === cell.stationId);
          if (!station) return null;
          const c = machineAt(cell);
          const solved = solvedIds.includes(cell.stationId);
          const gated = cellLocked(cell);
          const ringed = near?.key === `m-${cell.id}`;
          const tone = gated ? "gated" : solved ? "solved" : "idle";
          const device = STATION_DEVICE[`${room.slug}:${cell.stationId}`];
          return (
            <button
              key={cell.id}
              onClick={() => (gated ? setFlash(lockMessage(cell)) : setOpenId(cell.stationId!))}
              className={`absolute z-20 h-12 w-12 -translate-x-1/2 -translate-y-1/2 transition sm:h-14 sm:w-14 ${
                ringed ? "-translate-y-1 scale-110" : ""
              }`}
              style={{
                left: pct(c.x, W),
                top: pct(c.y, H),
                filter: ringed
                  ? "drop-shadow(0 0 5px rgba(248,113,113,0.95)) drop-shadow(0 3px 3px rgba(0,0,0,0.35))"
                  : "drop-shadow(0 3px 3px rgba(0,0,0,0.35))",
              }}
              title={gated ? "Locked — finish the room first" : solved ? `${station.label} (done)` : station.label}
            >
              {device ? <ThemedDevice device={device} tone={tone} /> : <MachineDevice kind={station.puzzle.kind} tone={tone} />}
            </button>
          );
        })}

        {/* Exit door */}
        {(() => {
          const er = geo.floors[layout.exit];
          if (!er) return null;
          const c = centerOf(er);
          return (
            <button
              onClick={() => exitReady && performAction(near?.kind === "exit" ? near : { key: "exit", kind: "exit", id: layout.exit, label: "", x: c.x, y: c.y, enabled: true })}
              className={`absolute z-20 h-12 w-10 -translate-x-1/2 transition sm:h-16 sm:w-12 ${exitReady ? "animate-pulse" : ""}`}
              style={{
                left: pct(c.x, W),
                top: pct(er.y + er.h - 4, H),
                transform: "translate(-50%, -100%)",
                filter: exitReady ? "drop-shadow(0 0 6px rgba(251,191,36,0.9))" : "drop-shadow(0 2px 2px rgba(0,0,0,0.35))",
              }}
              title={exitReady ? "Open the door" : "Locked — finish the room first"}
            >
              <Prop art={exitReady ? "doorOpen" : "doorLocked"} className="h-full w-full" />
            </button>
          );
        })()}

        {/* Other players (co-op) — placed in their current room */}
        {others.map((p, i) => {
          const r = p.atStation ? geo.floors[p.atStation] : null;
          if (!r) return null;
          return (
            <div
              key={p.learnerId}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 text-center"
              style={{ left: pct(r.x + r.w * (0.3 + (i % 3) * 0.2), W), top: pct(r.y + r.h * 0.75, H) }}
            >
              <div className="text-xl opacity-80 sm:text-2xl">{room.character}</div>
              <div className="rounded-full bg-slate-900/60 px-1.5 text-[8px] font-700 text-white">{p.name}</div>
            </div>
          );
        })}

        {/* You */}
        <div
          ref={charRef}
          className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2 text-center"
          style={{ left: pct(spawnCenter.x, W), top: pct(spawnCenter.y, H) }}
        >
          {heldItem && (
            <div className="relative mx-auto mb-0.5 h-5 w-5 drop-shadow sm:h-6 sm:w-6">
              {carry?.mode === "charge" ? (
                <span
                  className="flex h-full w-full items-center justify-center rounded-full ring-2 ring-white/70"
                  style={{ background: carriedReady ? "radial-gradient(circle at 35% 30%, #fde68a, #f59e0b 55%, #b45309)" : "radial-gradient(circle at 35% 30%, #bae6fd, #38bdf8 55%, #075985)" }}
                >
                  {carriedReady && heldItem.station && <StationIcon name={STATION_ICON[`${room.slug}:${heldItem.station}`] ?? "core"} className="h-3 w-3 text-white sm:h-3.5 sm:w-3.5" />}
                </span>
              ) : (
                <Prop
                  art={carry?.mode === "recycle" ? "bottle" : ITEM_PROP[heldItem.icon ?? ""] ?? "scroll"}
                  className="h-full w-full"
                  style={carry?.mode === "recycle" && !carriedReady ? { filter: "grayscale(1) brightness(0.82)" } : undefined}
                />
              )}
              {coreNumber(heldItem.id) && (
                <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-900 font-fun text-[8px] font-700 text-white ring-1 ring-white/70 sm:h-4 sm:w-4 sm:text-[9px]">
                  {coreNumber(heldItem.id)}
                </span>
              )}
            </div>
          )}
          <div className="text-2xl drop-shadow sm:text-3xl">{room.character}</div>
          {isCoop && <div className="rounded-full bg-coral px-1.5 text-[8px] font-700 text-white">You</div>}
        </div>

        {/* Transient carry hint */}
        {flash && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-50 -translate-x-1/2 rounded-full bg-slate-900/80 px-4 py-1.5 font-fun text-xs font-700 text-white shadow-lg sm:text-sm">
            {flash}
          </div>
        )}

        {/* Action button — falls back to "Set down" whenever you're carrying. */}
        {(near || carrying) && (
          <button
            onClick={() => performAction(near)}
            className="absolute bottom-4 right-4 z-50 rounded-full bg-coral px-5 py-3 font-fun text-sm font-700 text-white shadow-lg ring-2 ring-white/50 transition hover:scale-105"
          >
            {near?.label ?? `Set down ${labelOf(carrying)}`}
          </button>
        )}

        {/* On-screen D-pad — touch devices only (no keyboard to walk with). */}
        {touch && (
          <div className="absolute bottom-4 left-4 z-50 grid select-none grid-cols-3 gap-1">
            <span />
            <button {...holdDir(0, -1)} aria-label="Move up" className={worldDpad}>
              ⬆️
            </button>
            <span />
            <button {...holdDir(-1, 0)} aria-label="Move left" className={worldDpad}>
              ⬅️
            </button>
            <span />
            <button {...holdDir(1, 0)} aria-label="Move right" className={worldDpad}>
              ➡️
            </button>
            <span />
            <button {...holdDir(0, 1)} aria-label="Move down" className={worldDpad}>
              ⬇️
            </button>
            <span />
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 font-fun text-sm font-700 text-slate-500">
        <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-100">
          🧩 {solvedIds.length}/{total} puzzles
        </span>
        {carryItems.length > 0 && (
          <span className="rounded-full bg-white px-3 py-1 shadow-sm ring-1 ring-slate-100">
            {carry?.mode === "recycle" ? "♻️" : "📦"} {delivered.length}/{carryItems.length}{" "}
            {carry?.mode === "recycle" ? "recycled" : carry?.mode === "direct" ? "placed" : "delivered"}
          </span>
        )}
        {carrying && (
          <span className="rounded-full bg-coral/10 px-3 py-1 text-coral ring-1 ring-coral/20">
            Carrying {coreNumber(carrying) ? `core ${coreNumber(carrying)}` : labelOf(carrying)} {coreNumber(carrying) ? "" : heldItem?.emoji}
            {carriedReady ? (carry?.mode === "recycle" ? " ✨ clean" : " ⚡ charged") : ""}
          </span>
        )}
        <span className="rounded-full bg-white px-3 py-1 text-slate-400 shadow-sm ring-1 ring-slate-100">
          {touch
            ? "Use the arrows to move · tap an object or the button to interact"
            : "Move with the arrow keys or WASD · Space to interact"}
        </span>
      </div>

      {/* Puzzle modal (see PuzzleModal). */}
      {openStation && (
        <PuzzleModal
          station={openStation}
          roomSlug={room.slug}
          reviewing={reviewing}
          lockPuzzle={lockPuzzle}
          hiddenWords={hiddenWords}
          wordHints={wordHints}
          orderUnlocked={orderUnlocked}
          justSolved={justSolved}
          hintShown={hintShown}
          wrongCount={wrongCount}
          allSolved={allSolved}
          onClose={closeModal}
          onSolved={handleSolved}
          onWrong={() => setWrongCount((c) => c + 1)}
          onShowHint={() => setHintShown(true)}
        />
      )}

      {/* Clue note */}
      {noteData && <NoteCard note={noteData} room={room} onClose={() => setOpenNote(null)} />}

      <ExitLocks
        open={doorOpen}
        codeSlots={codeSlots}
        exitCode={exitCode}
        cipherExit={cipherExit}
        unscrambleExit={unscrambleExit}
        solvedIds={solvedIds}
        outro={room.outro}
        coresDone={coresDone}
        onWordSolved={(i) => setCoresDone((d) => (d.includes(i) ? d : [...d, i]))}
        onClose={() => setDoorOpen(false)}
        onEscape={onEscape}
      />
    </>
  );
}

/**
 * The puzzle pop-up: the puzzle to solve, a read-only recap once it's already
 * solved, the hint reveal, the wrong-answer nudge, and the "Solved!" card. The
 * room engine feeds it the current station's progress.
 */
function PuzzleModal({
  station,
  roomSlug,
  reviewing,
  lockPuzzle,
  hiddenWords,
  wordHints,
  orderUnlocked,
  justSolved,
  hintShown,
  wrongCount,
  allSolved,
  onClose,
  onSolved,
  onWrong,
  onShowHint,
}: {
  station: Station;
  roomSlug: string;
  reviewing: boolean;
  lockPuzzle: boolean;
  hiddenWords: Set<string>;
  wordHints: Map<string, string>;
  orderUnlocked: boolean;
  justSolved: boolean;
  hintShown: boolean;
  wrongCount: number;
  allSolved: boolean;
  onClose: () => void;
  onSolved: () => void;
  onWrong: () => void;
  onShowHint: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Close puzzle" onClick={onClose} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl ring-1 ring-amber-100">
        <div className="flex items-center gap-2 font-fun font-700 text-slate-700">
          <StationIcon name={STATION_ICON[`${roomSlug}:${station.id}`] ?? "panel"} className="h-6 w-6 text-slate-500" />
          {station.label}
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        {reviewing ? (
          <div className="mt-4">
            <div className="rounded-2xl bg-sky/10 py-2 text-center font-fun text-sm font-700 text-sky-700 ring-1 ring-sky/20">
              ✅ Already solved — here&apos;s a recap.
            </div>
            <PuzzleReview puzzle={station.puzzle} wordHints={wordHints} />
            <div className="mt-4 rounded-2xl bg-mint/15 p-4 text-center ring-1 ring-mint/30">
              <p className="font-round text-sm text-slate-600">{station.puzzle.learn}</p>
            </div>
            <div className="mt-4 text-center">
              <button onClick={onClose} className="rounded-full bg-coral px-7 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105">
                Got it 👍
              </button>
            </div>
          </div>
        ) : (
          <>
            <PuzzleView
              key={station.id}
              puzzle={station.puzzle}
              solved={lockPuzzle}
              hiddenWords={hiddenWords}
              wordHints={wordHints}
              showCoords
              orderUnlocked={orderUnlocked}
              onSolved={onSolved}
              onWrong={onWrong}
            />

            {!justSolved && (
              <div className="mt-5 text-center">
                {hintShown ? (
                  <p className="font-round text-sm text-amber-600">💡 {station.puzzle.hint}</p>
                ) : (
                  <button
                    onClick={onShowHint}
                    className="font-fun text-sm font-600 text-slate-400 underline-offset-2 hover:text-amber-600 hover:underline"
                  >
                    Need a hint? 💡
                  </button>
                )}
                {wrongCount > 0 && (
                  <p className="mt-2 font-fun text-sm font-600 text-coral">Not quite — give it another go! 🔁</p>
                )}
              </div>
            )}

            {justSolved && (
              <div className="mt-6 rounded-2xl bg-mint/15 p-5 text-center ring-1 ring-mint/30">
                <div className="font-fun text-lg font-700 text-emerald-700">🔓 Solved!</div>
                <p className="mt-1 font-round text-sm text-slate-600">{station.puzzle.learn}</p>
                <button
                  onClick={onClose}
                  className="mt-4 rounded-full bg-coral px-7 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105"
                >
                  {allSolved ? "Back to the room 🚪" : "Keep exploring 🔍"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The exit locks. A room's exit is exactly one of a coordinate keypad, a cipher
 * decoder, or an unscramble console; this renders whichever the room uses, once
 * the door is open.
 */
function ExitLocks({
  open,
  codeSlots,
  exitCode,
  cipherExit,
  unscrambleExit,
  solvedIds,
  outro,
  coresDone,
  onWordSolved,
  onClose,
  onEscape,
}: {
  open: boolean;
  codeSlots: { value: string }[];
  exitCode: string;
  cipherExit: RoomCipherExit | null;
  unscrambleExit: RoomUnscrambleExit | null;
  solvedIds: string[];
  outro: string;
  coresDone: number[];
  onWordSolved: (i: number) => void;
  onClose: () => void;
  onEscape: () => void;
}) {
  if (!open) return null;
  if (codeSlots.length > 0)
    return <ExitKeypad slots={codeSlots} code={exitCode} outro={outro} onClose={onClose} onEscape={onEscape} />;
  if (cipherExit)
    return <CipherExitKeypad exit={cipherExit} solvedIds={solvedIds} outro={outro} onClose={onClose} onEscape={onEscape} />;
  if (unscrambleExit)
    return (
      <UnscrambleExitKeypad
        exit={unscrambleExit}
        solvedIds={solvedIds}
        outro={outro}
        done={coresDone}
        onWordSolved={onWordSolved}
        onClose={onClose}
        onEscape={onEscape}
      />
    );
  return null;
}

/** Read-only clue / "lab note" card (never "solved"). */
function NoteCard({ note, room, onClose }: { note: RoomNote; room: EscapeRoom; onClose: () => void }) {
  const carry = room.layout.carry;
  const chargeCarry = carry?.mode === "charge" ? carry : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Close note" onClick={onClose} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm rounded-[2rem] bg-amber-50 p-6 shadow-2xl ring-1 ring-amber-200">
        <div className="flex items-center gap-2 font-fun font-700 text-amber-800">
          <StationIcon name="note" className="h-6 w-6 text-amber-600" />
          {note.title}
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-lg text-amber-700 transition hover:bg-amber-200"
          >
            ✕
          </button>
        </div>
        <p className="mt-3 font-round text-sm text-slate-700">{note.body}</p>
        {note.art === "crossing" && (
          <div className="mt-4 rounded-2xl bg-white p-4 text-center font-mono text-sm text-slate-600 ring-1 ring-amber-100">
            <div className="mt-1 text-coral">　　2　↓　(Column)</div>
            <div className="mt-1 text-coral">1　→　⭐　　　　　　</div>
            <div className="mt-1 text-coral">(Row)　　　　　　　　　　　</div>
            <div className="mt-2 text-xs text-slate-400">Read the ⭐&apos;s Column &amp; Row.</div>
          </div>
        )}
        {note.art === "coremap" && chargeCarry && (() => {
          const L = room.layout;
          const stationNo = (sid?: string) => {
            const i = chargeCarry.items.findIndex((it) => it.station === sid);
            return i >= 0 ? i + 1 : null;
          };
          return (
            <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-amber-100">
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${L.cols}, 1fr)`, gridTemplateRows: `repeat(${L.rows}, minmax(2.4rem, 1fr))` }}
              >
                {L.cells.map((cell) => {
                  const no = stationNo(cell.stationId);
                  const isCore = cell.id === chargeCarry.coreRoom;
                  const isSuit = cell.id === chargeCarry.suitRoom;
                  const isSpawn = cell.id === L.spawn && !isCore && !isSuit && no == null;
                  return (
                    <div
                      key={cell.id}
                      style={{ gridColumn: `${cell.gx + 1} / span ${cell.gw ?? 1}`, gridRow: `${cell.gy + 1} / span ${cell.gh ?? 1}` }}
                      className={`flex flex-col items-center justify-center rounded-lg p-1 text-center ${
                        no != null
                          ? "bg-coral/15 ring-1 ring-coral/40"
                          : isCore
                            ? "bg-amber-100"
                            : isSuit
                              ? "bg-mint/30"
                              : "bg-slate-100"
                      }`}
                    >
                      {no != null ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-coral font-fun text-sm font-700 text-white">{no}</span>
                      ) : isCore ? (
                        <div className="flex gap-0.5">
                          {chargeCarry.items.map((_, i) => (
                            <span key={i} className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-[8px] font-700 text-white">
                              {i + 1}
                            </span>
                          ))}
                        </div>
                      ) : isSuit ? (
                        <span className="text-base">🦸</span>
                      ) : isSpawn ? (
                        <span className="text-base">🚪</span>
                      ) : null}
                      <span className="mt-0.5 text-[7px] font-600 leading-tight text-slate-500">{cell.label}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-center text-[10px] text-slate-500">
                🔘 cores wait in the {L.cells.find((c) => c.id === chargeCarry.coreRoom)?.label ?? "Landing"} · carry each to the charger with its number.
              </p>
            </div>
          );
        })()}
        <div className="mt-5 text-center">
          <button onClick={onClose} className="rounded-full bg-amber-500 px-7 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105">
            Got it 👍
          </button>
        </div>
      </div>
    </div>
  );
}

/** Shared "you escaped" card for solo play. */
function EscapedCard({
  room,
  score,
  onReplay,
}: {
  room: EscapeRoom;
  score: number | null;
  onReplay: () => void;
}) {
  return (
    <div className="mt-4 rounded-[2rem] bg-white p-10 text-center shadow-sm ring-1 ring-amber-100">
      <div className="text-7xl">🎉</div>
      <h2 className="mt-3 font-fun text-3xl font-700 text-slate-900">You escaped!</h2>
      <p className="mx-auto mt-2 max-w-md font-round text-slate-500">{room.outro}</p>
      {score != null && (
        <div className="mt-4 inline-block rounded-full bg-mint/20 px-5 py-1.5 font-fun font-700 text-emerald-600">
          +{score} points!
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button onClick={onReplay} className="rounded-full bg-coral px-6 py-3 font-fun font-700 text-white shadow">
          Play again 🔁
        </button>
        <Link href="/learn/escape-room" className="rounded-full bg-grape px-6 py-3 font-fun font-700 text-white shadow">
          Try another room 🗝️
        </Link>
        <Link href="/learn" className="rounded-full bg-slate-100 px-6 py-3 font-fun font-600 text-slate-600">
          All activities
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scenery + puzzles (unchanged)                                       */
/* ------------------------------------------------------------------ */

/**
 * A standing "machine" object on the map, drawn bespoke per puzzle kind so each
 * station reads as its own interactable gadget (keypad, decoder, bins, scale,
 * crossword board, padlock…) rather than a generic icon chip. Body colour shifts
 * to green when solved and slate when locked, with a check / padlock face.
 */
function MachineDevice({ kind, tone }: { kind: EscapeRoomPuzzle["kind"]; tone: "idle" | "solved" | "gated" }) {
  const palette: Record<EscapeRoomPuzzle["kind"], [string, string]> = {
    code: ["#3b82f6", "#1e40af"],
    mcq: ["#a855f7", "#6b21a8"],
    order: ["#14b8a6", "#0f766e"],
    wordsearch: ["#22c55e", "#15803d"],
    cipher: ["#6366f1", "#3730a3"],
    circuit: ["#f97316", "#c2410c"],
    sort: ["#06b6d4", "#0e7490"],
    maze: ["#0ea5e9", "#0369a1"],
    fair: ["#eab308", "#a16207"],
    crossword: ["#f59e0b", "#b45309"],
    "symbol-lock": ["#ef4444", "#991b1b"],
    unscramble: ["#fb923c", "#9a3412"],
    trailmaze: ["#10b981", "#047857"],
  };
  const [lite, dark] = tone === "gated" ? ["#64748b", "#334155"] : tone === "solved" ? ["#34d399", "#047857"] : palette[kind];
  const SCR = "#0b1326";

  const face = (() => {
    if (tone === "gated")
      return (
        <g>
          <path d="M19 25v-3a5 5 0 0 1 10 0v3" fill="none" stroke="#fde68a" strokeWidth="2.4" />
          <rect x="15" y="25" width="18" height="13" rx="2.5" fill="#fde68a" />
          <circle cx="24" cy="31" r="2.2" fill={dark} />
        </g>
      );
    if (tone === "solved")
      return <path d="M16 28l5 5 11-11" fill="none" stroke="#ecfdf5" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />;
    switch (kind) {
      case "code":
        return (
          <>
            <rect x="12" y="13" width="24" height="8" rx="1.5" fill={SCR} />
            <line x1="15" y1="16" x2="31" y2="16" stroke="#7dd3fc" strokeWidth="1.3" />
            <line x1="15" y1="18.6" x2="27" y2="18.6" stroke="#7dd3fc" strokeWidth="1.3" opacity="0.7" />
            {[0, 1, 2].map((r) => [0, 1, 2].map((col) => <rect key={`${r}-${col}`} x={13.5 + col * 8} y={24.5 + r * 5.3} width="6" height="3.8" rx="1" fill="#fff" opacity="0.9" />))}
          </>
        );
      case "mcq":
        return (
          <>
            <rect x="12" y="13" width="24" height="9" rx="1.5" fill={SCR} />
            <text x="24" y="20.5" fontSize="8" fontWeight="700" fill="#fff" textAnchor="middle">?</text>
            {[0, 1, 2].map((i) => <rect key={i} x="13" y={25.5 + i * 4.8} width="22" height="3.2" rx="1.6" fill="#fff" opacity={0.9 - i * 0.2} />)}
          </>
        );
      case "order":
        return (
          <>
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <circle cx="15" cy={17.5 + i * 8} r="2.7" fill="#fff" />
                <text x="15" y={19.4 + i * 8} fontSize="4.4" fontWeight="700" fill={dark} textAnchor="middle">{i + 1}</text>
                <rect x="20.5" y={15.8 + i * 8} width="15" height="3.4" rx="1.7" fill="#fff" opacity="0.85" />
              </g>
            ))}
          </>
        );
      case "wordsearch":
        return (
          <>
            {[0, 1, 2].map((r) => [0, 1, 2].map((col) => <rect key={`${r}-${col}`} x={11 + col * 6.4} y={13 + r * 6} width="5" height="5" rx="0.8" fill={SCR} opacity="0.5" />))}
            <circle cx="30" cy="33" r="5.4" fill="none" stroke="#fff" strokeWidth="1.8" />
            <line x1="34" y1="37" x2="38" y2="41" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
          </>
        );
      case "cipher":
        return (
          <>
            {[0, 1, 2].map((i) => <rect key={i} x={12 + i * 9} y="14" width="6.5" height="6.5" rx="1" fill="#fff" opacity="0.9" />)}
            <path d="M24 22.5v3.5M21 25l3 3 3-3" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            {["A", "B", "C"].map((ch, i) => <text key={i} x={15.2 + i * 9} y="38" fontSize="6" fontWeight="700" fill="#fff" textAnchor="middle">{ch}</text>)}
          </>
        );
      case "circuit":
        return (
          <>
            <circle cx="13" cy="32" r="2.6" fill="#fff" />
            <path d="M15.6 32H23v-9h7" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="33" cy="23" r="4.2" fill="#fde047" stroke="#fff" strokeWidth="1.4" />
            <path d="M31.4 23l1.3 1.3 2.1-2.5" fill="none" stroke={dark} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </>
        );
      case "sort":
        return (
          <>
            {[0, 1].map((i) => (
              <g key={i}>
                <rect x={11 + i * 13} y="20" width="11" height="2.6" rx="1" fill="#fff" />
                <path d={`M${12 + i * 13} 23 h9 l-1.2 15 h-6.6 z`} fill="#fff" opacity="0.9" />
              </g>
            ))}
          </>
        );
      case "maze":
      case "trailmaze":
        return (
          <>
            <rect x="11" y="13" width="26" height="24" rx="2" fill={SCR} />
            <path d="M14 16h8v6h-6v6h12v-9h6" fill="none" stroke="#7dd3fc" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="34.5" cy="19" r="1.9" fill="#34d399" />
          </>
        );
      case "fair":
        return (
          <>
            <line x1="24" y1="13" x2="24" y2="36" stroke="#fff" strokeWidth="1.7" />
            <polygon points="20,38 28,38 24,33" fill="#fff" />
            <line x1="13" y1="18" x2="35" y2="18" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M9.5 18a4 3 0 0 0 8 0" fill="none" stroke="#fff" strokeWidth="1.6" />
            <path d="M30.5 18a4 3 0 0 0 8 0" fill="none" stroke="#fff" strokeWidth="1.6" />
          </>
        );
      case "crossword":
        return (
          <>
            {[0, 1, 2].map((r) => [0, 1, 2, 3].map((col) => <rect key={`${r}-${col}`} x={9 + col * 7.4} y={14 + r * 7} width="6.2" height="6.2" rx="0.8" fill={col === 1 ? "#fde047" : "#fff"} opacity={col === 1 ? 1 : 0.85} />))}
          </>
        );
      case "symbol-lock":
        return (
          <>
            <path d="M18 26v-4a6 6 0 0 1 12 0v4" fill="none" stroke="#fff" strokeWidth="2.3" />
            <rect x="14" y="25" width="20" height="15" rx="2.5" fill="#fff" />
            <polygon points="24,29 26.4,33 21.6,33" fill={dark} />
          </>
        );
      case "unscramble":
        return (
          <>
            <rect x="10" y="33" width="28" height="3" rx="1.5" fill="#fff" opacity="0.5" />
            {["A", "C", "B"].map((ch, i) => (
              <g key={i}>
                <rect x={12 + i * 8.5} y="18" width="7.4" height="9.4" rx="1.4" fill="#fff" />
                <text x={15.7 + i * 8.5} y="25" fontSize="6" fontWeight="700" fill={dark} textAnchor="middle">{ch}</text>
              </g>
            ))}
          </>
        );
    }
  })();

  return (
    <svg viewBox="0 0 48 52" className="h-full w-full">
      <rect x="13" y="44" width="22" height="5" rx="2" fill={dark} />
      <rect x="6" y="5" width="36" height="40" rx="6" fill={lite} stroke={dark} strokeWidth="1.6" />
      <rect x="9" y="8" width="30" height="4.5" rx="2.2" fill="#fff" opacity="0.25" />
      {face}
    </svg>
  );
}

/**
 * Bespoke, free-standing themed objects for specific stations (a charger looks
 * like a sci-fi charger, etc.), keyed by `${roomSlug}:${stationId}`. Stations
 * not listed fall back to the puzzle-kind gadget above.
 */
const STATION_DEVICE: Record<string, string> = {
  "robot-lab:panel": "console",
  "robot-lab:robot": "robot",
  "robot-lab:decoder": "decoder",
  "robot-lab:poster": "screen",
  "kindness-castle:kindness": "charger",
  "kindness-castle:honesty": "charger",
  "kindness-castle:fairness": "charger",
  "green-lab:panel": "solar",
  "green-lab:bins": "manual",
  "green-lab:circuit": "fusebox",
  "sg-history:merlion": "pedestal",
  "sg-history:timeline": "vault",
  "sg-history:river": "statue",
  "sg-culture:food": "hawker",
  "sg-culture:festival": "lamp",
  "sg-culture:flower": "flower",
  "sg-culture:fruit": "fruit",
  "sg-culture:crossword": "crosswordboard",
  "sg-culture:lockpad": "lockpanel",
  "sg-nature:river": "river",
  "sg-nature:seed": "tree",
  "sg-nature:ranger": "signpost",
  "sg-nature:trailmap": "trailmap",
};

/** SVG art (viewBox 0 0 48 48) for each themed device type. */
const THEMED_ART: Record<string, React.ReactNode> = {
  // Sci-fi charging pod: glowing core tube fills with energy, lightning emblem.
  charger: (
    <>
      <ellipse cx="24" cy="43.5" rx="12" ry="2.4" fill="#4c1d95" opacity="0.45" />
      <rect x="14.5" y="39" width="19" height="4" rx="1.5" fill="#5b21b6" />
      <rect x="16" y="11" width="16" height="29" rx="6" fill="#7c3aed" stroke="#c4b5fd" strokeWidth="1.6" />
      <rect x="20" y="16" width="8" height="20" rx="4" fill="#0e1230" />
      <rect x="20.8" y="20" width="6.4" height="15.2" rx="3.2" fill="#22d3ee" />
      <path d="M25.5 19l-4 6h2.8l-1.5 5 4.7-7h-2.8z" fill="#fde047" />
      <rect x="12.5" y="20" width="2.4" height="11" rx="1.2" fill="#a78bfa" />
      <rect x="33.1" y="20" width="2.4" height="11" rx="1.2" fill="#a78bfa" />
      <circle cx="24" cy="8.5" r="2.6" fill="#67e8f9" />
      <circle cx="24" cy="8.5" r="4.8" fill="none" stroke="#67e8f9" strokeWidth="1" opacity="0.45" />
    </>
  ),
  // Robot-Lab control panel: keypad console (the reference image).
  console: (
    <>
      <rect x="11" y="11" width="26" height="30" rx="4" fill="#2563eb" stroke="#1e40af" strokeWidth="1.6" />
      <rect x="14" y="14" width="20" height="9" rx="1.6" fill="#0b1326" />
      <line x1="16.5" y1="17.5" x2="31.5" y2="17.5" stroke="#7dd3fc" strokeWidth="1.2" />
      <line x1="16.5" y1="20" x2="27" y2="20" stroke="#7dd3fc" strokeWidth="1.2" opacity="0.7" />
      {[0, 1, 2].map((r) => [0, 1, 2].map((col) => <rect key={`${r}-${col}`} x={15.5 + col * 6.6} y={26 + r * 4.3} width="5" height="3" rx="0.8" fill="#bfdbfe" />))}
    </>
  ),
  // Little robot helper.
  robot: (
    <>
      <line x1="24" y1="14" x2="24" y2="9" stroke="#64748b" strokeWidth="1.6" />
      <circle cx="24" cy="8" r="2" fill="#38bdf8" />
      <rect x="9.5" y="20" width="3" height="9" rx="1.5" fill="#94a3b8" />
      <rect x="35.5" y="20" width="3" height="9" rx="1.5" fill="#94a3b8" />
      <rect x="13" y="14" width="22" height="20" rx="5" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.6" />
      <rect x="16" y="18" width="16" height="9" rx="2.5" fill="#0f172a" />
      <circle cx="20.5" cy="22.5" r="2.1" fill="#38bdf8" />
      <circle cx="27.5" cy="22.5" r="2.1" fill="#38bdf8" />
      <rect x="19" y="29.5" width="10" height="2.2" rx="1.1" fill="#94a3b8" />
      <rect x="17" y="34" width="5" height="6" rx="1.5" fill="#94a3b8" />
      <rect x="26" y="34" width="5" height="6" rx="1.5" fill="#94a3b8" />
    </>
  ),
  // Symbol decoder unit.
  decoder: (
    <>
      <rect x="11" y="13" width="26" height="26" rx="3" fill="#6366f1" stroke="#3730a3" strokeWidth="1.6" />
      <rect x="14" y="16" width="20" height="8" rx="1.5" fill="#0b1326" />
      {[0, 1, 2].map((i) => <rect key={i} x={16.5 + i * 6.5} y="18" width="4.4" height="4.4" rx="0.8" fill="#a5b4fc" />)}
      <path d="M24 24.5v3M21 26.5l3 2.5 3-2.5" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {["A", "B", "C"].map((ch, i) => <text key={i} x={17.5 + i * 6.5} y="37" fontSize="5.5" fontWeight="700" fill="#fff" textAnchor="middle">{ch}</text>)}
    </>
  ),
  // Monitor screen (word display / trail map).
  screen: (
    <>
      <rect x="20" y="34" width="8" height="5" fill="#475569" />
      <rect x="15" y="38" width="18" height="3" rx="1.2" fill="#64748b" />
      <rect x="8" y="10" width="32" height="24" rx="3" fill="#0f172a" stroke="#475569" strokeWidth="1.6" />
      {[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((col) => <rect key={`${r}-${col}`} x={11 + col * 7} y={13 + r * 5} width="5.5" height="3.6" rx="0.6" fill="#4ade80" opacity={0.35 + ((r + col) % 3) * 0.22} />))}
    </>
  ),
  // Tilted solar panel on a pole (no sun).
  solar: (
    <>
      <line x1="24" y1="29" x2="24" y2="40" stroke="#64748b" strokeWidth="2.2" />
      <rect x="20" y="40" width="8" height="2.6" rx="1" fill="#64748b" />
      <g transform="rotate(-14 24 21)">
        <rect x="10" y="14" width="28" height="15" rx="1.5" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="1.3" />
        {[1, 2, 3].map((col) => <line key={col} x1={10 + col * 7} y1="14" x2={10 + col * 7} y2="29" stroke="#60a5fa" strokeWidth="0.8" />)}
        <line x1="10" y1="21.5" x2="38" y2="21.5" stroke="#60a5fa" strokeWidth="0.8" />
      </g>
    </>
  ),
  // Recycling unit: green bin with a recycle trefoil.
  recycler: (
    <>
      <path d="M14 18h20l-2 22H16z" fill="#16a34a" stroke="#15803d" strokeWidth="1.4" />
      <rect x="11.5" y="14.5" width="25" height="4" rx="1.5" fill="#15803d" />
      <rect x="20" y="12" width="8" height="3" rx="1" fill="#22c55e" />
      {[0, 1, 2].map((i) => <polygon key={i} points="24,24 27.5,30 20.5,30" fill="#dcfce7" transform={`rotate(${i * 120} 24 30)`} />)}
    </>
  ),
  // Power circuit / fuse box wired to a bulb.
  fusebox: (
    <>
      <rect x="12" y="12" width="24" height="28" rx="3" fill="#f97316" stroke="#c2410c" strokeWidth="1.6" />
      <rect x="15" y="15" width="18" height="3" rx="1" fill="#fdba74" />
      <circle cx="18" cy="32" r="2.6" fill="#fff" />
      <path d="M20.6 32H27v-9h6" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="33" cy="22" r="3.8" fill="#fde047" stroke="#fff" strokeWidth="1.2" />
      <path d="M31.4 22l1.3 1.3 2-2.4" fill="none" stroke="#c2410c" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="15" y="28" width="3.5" height="6" rx="1" fill="#fed7aa" />
    </>
  ),
  // Museum pedestal holding a scroll (Founding Gallery).
  pedestal: (
    <>
      <rect x="14" y="40" width="20" height="2.6" rx="1" fill="#854d0e" />
      <rect x="16.5" y="30" width="15" height="10" rx="1.5" fill="#b45309" stroke="#854d0e" strokeWidth="1.2" />
      <rect x="15" y="28" width="18" height="2.6" rx="1" fill="#a16207" />
      <rect x="19" y="13" width="10" height="14" rx="1.5" fill="#fef3c7" stroke="#b45309" strokeWidth="1.2" />
      <circle cx="19" cy="13.5" r="1.6" fill="#fde68a" stroke="#b45309" strokeWidth="1" />
      <circle cx="29" cy="13.5" r="1.6" fill="#fde68a" stroke="#b45309" strokeWidth="1" />
      <line x1="21.5" y1="18" x2="26.5" y2="18" stroke="#b45309" strokeWidth="1" />
      <line x1="21.5" y1="21" x2="26.5" y2="21" stroke="#b45309" strokeWidth="1" />
      <line x1="21.5" y1="24" x2="24.5" y2="24" stroke="#b45309" strokeWidth="1" />
    </>
  ),
  // Heritage vault door with a brass dial (Independence Hall).
  vault: (
    <>
      <rect x="11" y="12" width="26" height="28" rx="3" fill="#9f1239" stroke="#881337" strokeWidth="1.6" />
      <circle cx="24" cy="26" r="8.5" fill="#7f1d3a" stroke="#fda4af" strokeWidth="1.5" />
      <circle cx="24" cy="26" r="2.4" fill="#fecdd3" />
      {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1="24" y1="26" x2="24" y2="18.5" stroke="#fda4af" strokeWidth="1.2" transform={`rotate(${i * 60} 24 26)`} />)}
      <rect x="16" y="14.5" width="16" height="2.6" rx="1" fill="#fb7185" />
    </>
  ),
  // Merlion statue on a plinth (Lion City Room).
  statue: (
    <>
      <rect x="15" y="37" width="18" height="3" rx="1" fill="#94a3b8" />
      <rect x="18" y="32" width="12" height="6" rx="1" fill="#cbd5e1" />
      {[[16.5, 22], [18.5, 16], [24, 14], [29.5, 16], [31.5, 22]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.7" fill="#cbd5e1" />)}
      <circle cx="24" cy="22" r="8" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.3" />
      <circle cx="21.5" cy="21.5" r="1" fill="#0f172a" />
      <circle cx="26.5" cy="21.5" r="1" fill="#0f172a" />
      <path d="M22.5 25.5q1.5 1.5 3 0" stroke="#475569" strokeWidth="1" fill="none" />
      <path d="M16 31q-3 1.5-3.5 5" stroke="#38bdf8" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </>
  ),
  // Hawker stall with an awning and a steaming bowl.
  hawker: (
    <>
      <rect x="11" y="22" width="26" height="17" rx="1.5" fill="#fbbf24" stroke="#b45309" strokeWidth="1.3" />
      <rect x="13" y="30" width="22" height="9" fill="#a16207" opacity="0.35" />
      <path d="M10 22v-1a2 2 0 0 1 2-2h24a2 2 0 0 1 2 2v1z" fill="#dc2626" />
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M${10 + i * 7} 22l3.5 3 3.5-3z`} fill="#fca5a5" />)}
      <path d="M20 28h8l-1 4h-6z" fill="#fff7ed" stroke="#7c2d12" strokeWidth="1" />
      <path d="M22 27c-0.5-1.5 1-2 0.5-3.5M25.5 27c-0.5-1.5 1-2 0.5-3.5" stroke="#fff" strokeWidth="0.9" fill="none" opacity="0.7" />
    </>
  ),
  // Diya oil lamp with a flame.
  lamp: (
    <>
      <ellipse cx="24" cy="40" rx="11" ry="2.2" fill="#92400e" opacity="0.4" />
      <path d="M13 31h22l-3 7a3 2 0 0 1-16 0z" fill="#d97706" stroke="#92400e" strokeWidth="1.2" />
      <ellipse cx="24" cy="31" rx="11" ry="2.6" fill="#fbbf24" />
      <path d="M31 31c0-2-1.5-2.5-1-4" stroke="#92400e" strokeWidth="1" fill="none" />
      <path d="M24 30c-2.5-4 2-6 0-13-2.5 7 2.5 9 0 13z" fill="#f97316" />
      <path d="M24 27c-1.2-2 1-3 0-6-1.2 3 1.2 4 0 6z" fill="#fde047" />
    </>
  ),
  // Orchid bloom on a stem.
  flower: (
    <>
      <line x1="24" y1="22" x2="24" y2="40" stroke="#15803d" strokeWidth="2.2" />
      <path d="M24 33c-5-1-6-6-1-6" fill="#4ade80" />
      <ellipse cx="24" cy="12" rx="3" ry="5.5" fill="#c084fc" />
      <ellipse cx="24" cy="23" rx="3" ry="5.5" fill="#c084fc" />
      <ellipse cx="15.5" cy="17.5" rx="5.5" ry="3" fill="#a855f7" />
      <ellipse cx="32.5" cy="17.5" rx="5.5" ry="3" fill="#a855f7" />
      <circle cx="24" cy="17.5" r="3.4" fill="#fde047" />
    </>
  ),
  // Spiky durian on a fruit crate.
  fruit: (
    <>
      <rect x="13" y="31" width="22" height="8" rx="1.5" fill="#a16207" stroke="#854d0e" strokeWidth="1" />
      <line x1="13" y1="35" x2="35" y2="35" stroke="#854d0e" strokeWidth="0.8" />
      <circle cx="24" cy="22" r="9.5" fill="#84cc16" stroke="#4d7c0f" strokeWidth="1.3" />
      {[[24, 10], [31, 13], [34, 21], [31, 29], [24, 32], [17, 29], [14, 21], [17, 13]].map(([x, y], i) => <polygon key={i} points={`${x},${y - 2.5} ${x + 2.2},${y + 1.5} ${x - 2.2},${y + 1.5}`} fill="#4d7c0f" />)}
    </>
  ),
  // Crossword board with a highlighted column.
  crosswordboard: (
    <>
      <rect x="9" y="11" width="30" height="30" rx="2.5" fill="#fffbeb" stroke="#b45309" strokeWidth="1.6" />
      {[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((col) => <rect key={`${r}-${col}`} x={11 + col * 7} y={13 + r * 7} width="6.4" height="6.4" rx="0.6" fill={col === 1 ? "#fde047" : "#fff"} stroke="#d6d3d1" strokeWidth="0.7" />))}
    </>
  ),
  // Sci-fi exit lock panel.
  lockpanel: (
    <>
      <rect x="12" y="11" width="24" height="30" rx="4" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.6" />
      <circle cx="24" cy="8" r="2" fill="#fca5a5" />
      <path d="M19 23v-3a5 5 0 0 1 10 0v3" fill="none" stroke="#fff" strokeWidth="2.3" />
      <rect x="15.5" y="22.5" width="17" height="13" rx="2.5" fill="#fff" />
      <circle cx="24" cy="28" r="2.2" fill="#7f1d1d" />
      <rect x="22.8" y="29" width="2.4" height="4.5" rx="1" fill="#7f1d1d" />
    </>
  ),
  // Lazy river with an otter.
  river: (
    <>
      <rect x="8" y="20" width="32" height="18" rx="3" fill="#0ea5e9" opacity="0.85" />
      {[26, 31, 36].map((y, i) => <path key={i} d={`M10 ${y}q4 -2.5 8 0t8 0t8 0`} fill="none" stroke="#bae6fd" strokeWidth="1.2" />)}
      <ellipse cx="24" cy="22" rx="6" ry="4.5" fill="#78350f" />
      <circle cx="24" cy="17" r="4" fill="#92400e" />
      <circle cx="22" cy="15" r="1.5" fill="#78350f" />
      <circle cx="26" cy="15" r="1.5" fill="#78350f" />
      <circle cx="22.5" cy="16.8" r="0.7" fill="#0f172a" />
      <circle cx="25.5" cy="16.8" r="0.7" fill="#0f172a" />
      <circle cx="24" cy="18.2" r="0.8" fill="#0f172a" />
    </>
  ),
  // Growing tree.
  tree: (
    <>
      <ellipse cx="24" cy="41" rx="10" ry="2" fill="#14532d" opacity="0.4" />
      <rect x="22" y="27" width="4" height="13" rx="1.2" fill="#7c4a1e" />
      <circle cx="24" cy="19" r="9" fill="#22c55e" />
      <circle cx="17" cy="23" r="6" fill="#16a34a" />
      <circle cx="31" cy="23" r="6" fill="#16a34a" />
      <circle cx="24" cy="15" r="6" fill="#4ade80" />
    </>
  ),
  // Folded paper trail map with a dotted route to a destination pin.
  trailmap: (
    <>
      <rect x="8" y="11" width="32" height="26" rx="2" fill="#fef3c7" stroke="#b45309" strokeWidth="1.6" />
      <line x1="18.7" y1="11" x2="18.7" y2="37" stroke="#d6a35c" strokeWidth="0.8" opacity="0.7" />
      <line x1="29.3" y1="11" x2="29.3" y2="37" stroke="#d6a35c" strokeWidth="0.8" opacity="0.7" />
      <line x1="8" y1="24" x2="40" y2="24" stroke="#d6a35c" strokeWidth="0.8" opacity="0.7" />
      <path d="M12 33C16 27 22 31 23 25S29 18 32 18" fill="none" stroke="#16a34a" strokeWidth="1.6" strokeDasharray="2 2.4" strokeLinecap="round" />
      <circle cx="12" cy="33" r="1.9" fill="#16a34a" />
      <path d="M32 13a3.6 3.6 0 0 1 3.6 3.6c0 2.6-3.6 5.6-3.6 5.6s-3.6-3-3.6-5.6A3.6 3.6 0 0 1 32 13z" fill="#dc2626" />
      <circle cx="32" cy="16.6" r="1.3" fill="#fff" />
    </>
  ),
  // Open instruction manual / booklet (recycling steps to put in order).
  manual: (
    <>
      <path d="M24 14C20 11 14 11 11 12v25c3-1 9-1 13 2z" fill="#bbf7d0" stroke="#15803d" strokeWidth="1.5" />
      <path d="M24 14c4-3 10-3 13-2v25c-3-1-9-1-13 2z" fill="#dcfce7" stroke="#15803d" strokeWidth="1.5" />
      <line x1="24" y1="14" x2="24" y2="39" stroke="#15803d" strokeWidth="1.2" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx="28" cy={20 + i * 5} r="1.5" fill="#16a34a" />
          <line x1="30.5" y1={20 + i * 5} x2="34" y2={20 + i * 5} stroke="#16a34a" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      ))}
      {[0, 1, 2].map((i) => <line key={i} x1="14" y1={20 + i * 5} x2="20" y2={20 + i * 5} stroke="#16a34a" strokeWidth="1.3" opacity="0.65" strokeLinecap="round" />)}
    </>
  ),
  // Ranger's carved wooden signpost.
  signpost: (
    <>
      <rect x="22.5" y="16" width="3.5" height="24" rx="1" fill="#7c4a1e" />
      <rect x="11" y="17" width="20" height="6" rx="1.5" fill="#a16207" stroke="#7c4a1e" strokeWidth="1" />
      <polygon points="31,17 35,20 31,23" fill="#a16207" stroke="#7c4a1e" strokeWidth="1" />
      {[0, 1, 2].map((i) => <circle key={i} cx={15 + i * 5} cy="20" r="1.4" fill="#fef3c7" />)}
      <rect x="17" y="26" width="20" height="6" rx="1.5" fill="#b45309" stroke="#7c4a1e" strokeWidth="1" />
      <polygon points="17,26 13,29 17,32" fill="#b45309" stroke="#7c4a1e" strokeWidth="1" />
      {[0, 1, 2].map((i) => <rect key={i} x={22 + i * 5} y="28.5" width="3" height="1.6" rx="0.5" fill="#fef3c7" />)}
    </>
  ),
};

/** Renders a themed station object with solved (✓) / locked (padlock) states. */
function ThemedDevice({ device, tone }: { device: string; tone: "idle" | "solved" | "gated" }) {
  const art = THEMED_ART[device];
  if (!art) return null;
  return (
    <div className="relative h-full w-full">
      <svg
        viewBox="0 0 48 48"
        className="h-full w-full"
        style={tone === "gated" ? { filter: "grayscale(1) brightness(0.6)" } : tone === "solved" ? { opacity: 0.92 } : undefined}
      >
        {art}
      </svg>
      {tone === "solved" && (
        <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white sm:h-5 sm:w-5">
          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 sm:h-3 sm:w-3" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4 4L19 6.5" />
          </svg>
        </span>
      )}
      {tone === "gated" && (
        <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-slate-800 ring-2 ring-white sm:h-5 sm:w-5">
          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 sm:h-3 sm:w-3" fill="none" stroke="#fbbf24" strokeWidth="2.5">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </span>
      )}
    </div>
  );
}

/** Small themed props (carriables, sink, recycler, door, note) — viewBox 0 0 40 40. */
const PROP_ART: Record<string, React.ReactNode> = {
  bottle: (
    <>
      <rect x="17" y="5" width="6" height="3" rx="1" fill="#0e7490" />
      <path d="M17 8h6v2l2 3a3 3 0 0 1 1 2v14a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3V15a3 3 0 0 1 1-2l2-3z" fill="#bae6fd" stroke="#0891b2" strokeWidth="1.5" />
      <rect x="14.5" y="20" width="11" height="6" rx="1" fill="#7dd3fc" opacity="0.7" />
    </>
  ),
  key: (
    <>
      <circle cx="14" cy="15" r="6.5" fill="none" stroke="#facc15" strokeWidth="3" />
      <circle cx="14" cy="15" r="2.2" fill="#a16207" />
      <line x1="18.5" y1="19.5" x2="31" y2="32" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
      <line x1="26.5" y1="27.5" x2="29.5" y2="24.5" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
      <line x1="29.5" y1="30.5" x2="32.5" y2="27.5" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  scroll: (
    <>
      <rect x="13" y="9" width="14" height="22" rx="2" fill="#fef3c7" stroke="#b45309" strokeWidth="1.5" />
      <circle cx="13" cy="9.5" r="2.4" fill="#fde68a" stroke="#b45309" strokeWidth="1.2" />
      <circle cx="27" cy="9.5" r="2.4" fill="#fde68a" stroke="#b45309" strokeWidth="1.2" />
      <line x1="16" y1="15" x2="24" y2="15" stroke="#b45309" strokeWidth="1.2" />
      <line x1="16" y1="19" x2="24" y2="19" stroke="#b45309" strokeWidth="1.2" />
      <line x1="16" y1="23" x2="21" y2="23" stroke="#b45309" strokeWidth="1.2" />
    </>
  ),
  flag: (
    <>
      <line x1="13" y1="6" x2="13" y2="34" stroke="#94a3b8" strokeWidth="2" />
      <rect x="13" y="7" width="18" height="6" fill="#dc2626" />
      <rect x="13" y="13" width="18" height="6" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
      <path d="M19 9a3 3 0 1 0 0 5 2.6 2.6 0 1 1 0-5z" fill="#fff" />
      {[[22, 8.5], [24, 10.5], [22.5, 12.5], [20.5, 12.5], [20.5, 10.5]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="0.7" fill="#fff" />)}
    </>
  ),
  merlion: (
    <>
      <rect x="13" y="30" width="14" height="3" rx="1" fill="#94a3b8" />
      <rect x="16" y="26" width="8" height="4" rx="1" fill="#cbd5e1" />
      {[[13.5, 19], [15, 14.5], [20, 13], [25, 14.5], [26.5, 19]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.2" fill="#cbd5e1" />)}
      <circle cx="20" cy="19" r="6.5" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.2" />
      <circle cx="18" cy="18.5" r="0.9" fill="#0f172a" />
      <circle cx="22" cy="18.5" r="0.9" fill="#0f172a" />
      <path d="M18.5 22q1.5 1.2 3 0" stroke="#475569" strokeWidth="0.9" fill="none" />
      <path d="M13.5 27q-2.5 1-3 4" stroke="#38bdf8" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </>
  ),
  sink: (
    <>
      <path d="M27 19v-5a3 3 0 0 0-3-3h-5" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
      <rect x="8" y="18" width="24" height="2.6" rx="1.3" fill="#7dd3fc" />
      <path d="M9.5 20.5h21l-1.5 5a7 5 0 0 1-18 0z" fill="#e0f2fe" stroke="#0891b2" strokeWidth="1.4" />
      <line x1="20" y1="22" x2="20" y2="26" stroke="#38bdf8" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="16.5" y1="22.5" x2="16.5" y2="25" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="23.5" y1="22.5" x2="23.5" y2="25" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  recycler: (
    <>
      <path d="M12 16h16l-1.5 17h-13z" fill="#16a34a" stroke="#15803d" strokeWidth="1.4" />
      <rect x="10" y="13" width="20" height="3.5" rx="1.5" fill="#15803d" />
      <rect x="16" y="11" width="8" height="2.6" rx="1" fill="#22c55e" />
      {[0, 1, 2].map((i) => <polygon key={i} points="20,21 23,26 17,26" fill="#dcfce7" transform={`rotate(${i * 120} 20 26)`} />)}
    </>
  ),
  note: (
    <>
      <rect x="11" y="8" width="18" height="25" rx="2" fill="#fef9c3" stroke="#ca8a04" strokeWidth="1.5" />
      <rect x="16" y="6" width="8" height="4" rx="1.5" fill="#a16207" />
      <line x1="14.5" y1="16" x2="25.5" y2="16" stroke="#ca8a04" strokeWidth="1.2" />
      <line x1="14.5" y1="20" x2="25.5" y2="20" stroke="#ca8a04" strokeWidth="1.2" />
      <line x1="14.5" y1="24" x2="22" y2="24" stroke="#ca8a04" strokeWidth="1.2" />
    </>
  ),
  doorOpen: (
    <>
      <rect x="9" y="5" width="22" height="32" rx="2" fill="#334155" stroke="#1e293b" strokeWidth="1.6" />
      <rect x="12.5" y="8" width="15" height="29" rx="1" fill="#fde68a" />
      <rect x="12.5" y="8" width="6.5" height="29" rx="1" fill="#f59e0b" />
      <circle cx="17" cy="23" r="1.1" fill="#7c2d12" />
    </>
  ),
  doorLocked: (
    <>
      <rect x="9" y="5" width="22" height="32" rx="2" fill="#475569" stroke="#1e293b" strokeWidth="1.6" />
      <line x1="20" y1="5" x2="20" y2="37" stroke="#1e293b" strokeWidth="1" />
      <rect x="15" y="19" width="10" height="8" rx="1.5" fill="#fbbf24" />
      <path d="M16.8 19v-2a3.2 3.2 0 0 1 6.4 0v2" fill="none" stroke="#fbbf24" strokeWidth="1.6" />
      <circle cx="20" cy="23" r="1.3" fill="#1e293b" />
    </>
  ),
  // --- purely cosmetic decor props (non-interactable) ---
  crate: (
    <>
      <rect x="9" y="15" width="22" height="18" rx="2" fill="#334155" stroke="#0f172a" strokeWidth="1.4" />
      <rect x="12" y="18" width="16" height="12" rx="1" fill="#475569" />
      <path d="M12 18l16 12M28 18L12 30" stroke="#64748b" strokeWidth="1.2" />
      <circle cx="20" cy="24" r="2.2" fill="#38bdf8" />
    </>
  ),
  serverRack: (
    <>
      <rect x="11" y="8" width="18" height="25" rx="1.5" fill="#111c30" stroke="#1e3a5f" strokeWidth="1.2" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x="13.5" y={11 + i * 5.5} width="13" height="3.4" rx="0.8" fill="#0f1828" />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <circle key={`l${i}`} cx="25" cy={12.7 + i * 5.5} r="0.9" fill={i % 2 ? "#34d399" : "#fbbf24"} />
      ))}
    </>
  ),
  halfRobot: (
    <>
      {/* workbench the robot is being assembled on */}
      <rect x="8" y="30" width="24" height="3" rx="1" fill="#475569" />
      <rect x="10" y="33" width="2.5" height="4" fill="#334155" />
      <rect x="27.5" y="33" width="2.5" height="4" fill="#334155" />
      {/* torso with an open chest panel + exposed wiring */}
      <rect x="15" y="16" width="12" height="14" rx="2" fill="#94a3b8" stroke="#475569" strokeWidth="1.2" />
      <rect x="17.5" y="19" width="7" height="6" rx="1" fill="#1e293b" />
      <path d="M18.5 22h1.5M21 20.5v3M23 21.5l1 1.5" stroke="#f59e0b" strokeWidth="0.8" fill="none" />
      <circle cx="19" cy="21" r="0.7" fill="#ef4444" />
      <circle cx="23.5" cy="24" r="0.7" fill="#22d3ee" />
      {/* one arm on, one missing; neck stub; detached head resting on the bench */}
      <rect x="11" y="18" width="3.5" height="9" rx="1.5" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
      <rect x="19.5" y="13.5" width="3" height="3" fill="#64748b" />
      <rect x="29.5" y="25.5" width="6.5" height="5" rx="1.5" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
      <circle cx="31.4" cy="28" r="0.8" fill="#38bdf8" />
      <circle cx="34" cy="28" r="0.8" fill="#38bdf8" />
    </>
  ),
  // Stretched conduit — three strands drooping between the endpoints (a catenary
  // sag reads as hanging cables, not a floating line). Non-scaling strokes keep
  // the cable thickness crisp when the box is scaled wide.
  cable: (
    <>
      <path d="M1 11 q 19 21 38 0" stroke="#1e293b" strokeWidth="3.4" fill="none" vectorEffect="non-scaling-stroke" />
      <path d="M1 11 q 19 16 38 0" stroke="#0891b2" strokeWidth="2.2" fill="none" opacity="0.9" vectorEffect="non-scaling-stroke" />
      <path d="M1 12 q 19 25 38 0" stroke="#f59e0b" strokeWidth="2" fill="none" opacity="0.8" vectorEffect="non-scaling-stroke" />
    </>
  ),
  // A dummy control monitor on a stand — screen with a little waveform + status LEDs.
  screen: (
    <>
      <rect x="7" y="9" width="26" height="18" rx="2" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
      <rect x="9.5" y="11.5" width="21" height="13" rx="1" fill="#0b2a3a" />
      <path d="M11 19l3-3 3 4 3-5 3 3 3-2" fill="none" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="11" y1="22.5" x2="29" y2="22.5" stroke="#155e75" strokeWidth="0.8" />
      <circle cx="12" cy="13.5" r="0.8" fill="#34d399" />
      <circle cx="14.5" cy="13.5" r="0.8" fill="#fbbf24" />
      <rect x="18.5" y="27" width="3" height="4" fill="#334155" />
      <rect x="13" y="31" width="14" height="2.5" rx="1" fill="#475569" />
    </>
  ),
  // A wall storage shelf with a few parts boxes / canisters on two boards.
  shelf: (
    <>
      <rect x="7" y="15" width="1.6" height="16" fill="#57534e" />
      <rect x="31.4" y="15" width="1.6" height="16" fill="#57534e" />
      <rect x="6" y="15.5" width="28" height="2.4" rx="0.5" fill="#8a7a63" stroke="#57534e" strokeWidth="0.6" />
      <rect x="6" y="26.5" width="28" height="2.4" rx="0.5" fill="#8a7a63" stroke="#57534e" strokeWidth="0.6" />
      {/* items on the top board */}
      <rect x="10" y="9.5" width="5" height="6" rx="0.8" fill="#38bdf8" />
      <rect x="17" y="8.5" width="4" height="7" rx="0.8" fill="#f59e0b" />
      <circle cx="26" cy="12.5" r="3" fill="#34d399" />
      {/* items on the bottom board */}
      <rect x="11" y="20.5" width="6" height="6" rx="0.8" fill="#a855f7" />
      <rect x="22" y="21.5" width="4" height="5" rx="0.8" fill="#ef4444" />
      <circle cx="29" cy="24" r="2.5" fill="#facc15" />
    </>
  ),
};

/** Maps a carry item's `icon` to its themed prop art (direct-delivery items). */
const ITEM_PROP: Record<string, string> = { key: "key", lion: "merlion", flag: "flag", note: "scroll" };

/** Renders a small themed prop SVG (carriable / sink / door / note). */
function Prop({ art, className, style }: { art: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 40 40" className={className} style={style}>
      {PROP_ART[art]}
    </svg>
  );
}

/** Which line-art icon each station shows, keyed by `${roomSlug}:${stationId}`. */
const STATION_ICON: Record<string, string> = {
  "robot-lab:panel": "panel",
  "robot-lab:robot": "robot",
  "robot-lab:decoder": "key",
  "robot-lab:poster": "screen",
  "kindness-castle:kindness": "heart",
  "kindness-castle:honesty": "shield",
  "kindness-castle:fairness": "scales",
  "green-lab:panel": "solar",
  "green-lab:bins": "bin",
  "green-lab:circuit": "plug",
  "sg-history:merlion": "note",
  "sg-history:timeline": "panel",
  "sg-history:river": "lion",
  "sg-culture:food": "skewer",
  "sg-culture:festival": "lantern",
  "sg-culture:flower": "flower",
  "sg-culture:fruit": "key",
  "sg-culture:crossword": "grid",
  "sg-culture:lockpad": "lock",
  "sg-nature:river": "water",
  "sg-nature:seed": "sprout",
  "sg-nature:ranger": "key",
  "sg-nature:trailmap": "map",
};

/** Hand-drawn line-art icon for a station (stroke = currentColor → themed). */
function StationIcon({ name, className }: { name: string; className?: string }) {
  const inner: Record<string, React.ReactNode> = {
    check: <path d="M5 12.5l4 4L19 6.5" />,
    panel: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <line x1="6" y1="9" x2="18" y2="9" />
        <circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none" />
        <line x1="6" y1="13" x2="18" y2="13" />
        <circle cx="15" cy="13" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="7" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
        <circle cx="10" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
      </>
    ),
    robot: (
      <>
        <rect x="5" y="8" width="14" height="11" rx="2.5" />
        <line x1="12" y1="5" x2="12" y2="8" />
        <circle cx="12" cy="4" r="1" fill="currentColor" stroke="none" />
        <circle cx="9.5" cy="12.5" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="14.5" cy="12.5" r="1.2" fill="currentColor" stroke="none" />
        <line x1="9.5" y1="16" x2="14.5" y2="16" />
      </>
    ),
    key: (
      <>
        <circle cx="8.5" cy="8.5" r="3.5" />
        <line x1="11" y1="11" x2="19.5" y2="19.5" />
        <line x1="16.5" y1="16.5" x2="18.5" y2="14.5" />
        <line x1="18.5" y1="18.5" x2="20.5" y2="16.5" />
      </>
    ),
    screen: (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <line x1="6" y1="8" x2="14" y2="8" />
        <line x1="6" y1="11" x2="11" y2="11" />
        <line x1="9" y1="20" x2="15" y2="20" />
        <line x1="12" y1="16" x2="12" y2="20" />
      </>
    ),
    heart: (
      <path d="M12 20C5 15 3 11.5 3 8.8 3 6.5 4.8 5 7 5c1.6 0 3 1 5 3 2-2 3.4-3 5-3 2.2 0 4 1.5 4 3.8 0 2.7-2 6.2-9 11.2Z" />
    ),
    shield: (
      <>
        <path d="M12 3l7 3v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6Z" />
        <path d="M9 12l2.2 2.2L15 10" />
      </>
    ),
    scales: (
      <>
        <line x1="12" y1="5" x2="12" y2="20" />
        <circle cx="12" cy="4.5" r="1" fill="currentColor" stroke="none" />
        <line x1="9" y1="20" x2="15" y2="20" />
        <line x1="5" y1="8" x2="19" y2="8" />
        <path d="M5 8l-2.5 5a3.5 3.5 0 0 0 5 0Z" />
        <path d="M19 8l-2.5 5a3.5 3.5 0 0 0 5 0Z" />
      </>
    ),
    solar: (
      <>
        <circle cx="18" cy="5" r="1.6" />
        <path d="M4 18l3.5-9H20l-3.5 9Z" />
        <line x1="6.2" y1="13.5" x2="17.8" y2="13.5" />
        <line x1="11" y1="9" x2="10" y2="18" />
        <line x1="15" y1="9" x2="13.5" y2="18" />
      </>
    ),
    bin: (
      <>
        <path d="M6.5 8l1 12h9l1-12" />
        <line x1="4.5" y1="8" x2="19.5" y2="8" />
        <path d="M10 8V5.5h4V8" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </>
    ),
    plug: (
      <>
        <line x1="9" y1="3.5" x2="9" y2="7" />
        <line x1="15" y1="3.5" x2="15" y2="7" />
        <path d="M7 7h10v3a5 5 0 0 1-10 0Z" />
        <path d="M12 15v3a3 3 0 0 0 3 3h2" />
      </>
    ),
    lion: (
      <>
        <circle cx="12" cy="13" r="4.5" />
        <circle cx="8.5" cy="9" r="1.5" />
        <circle cx="15.5" cy="9" r="1.5" />
        <circle cx="10.5" cy="12.5" r="0.7" fill="currentColor" stroke="none" />
        <circle cx="13.5" cy="12.5" r="0.7" fill="currentColor" stroke="none" />
        <path d="M11 14.8q1 0.9 2 0" />
        <line x1="12" y1="8.5" x2="12" y2="6.8" />
        <line x1="16.5" y1="13" x2="18.2" y2="13" />
        <line x1="7.5" y1="13" x2="5.8" y2="13" />
        <line x1="15.4" y1="9.6" x2="16.6" y2="8.4" />
        <line x1="8.6" y1="9.6" x2="7.4" y2="8.4" />
      </>
    ),
    box: (
      <>
        <rect x="4.5" y="8" width="15" height="11.5" rx="1" />
        <line x1="4.5" y1="12" x2="19.5" y2="12" />
        <path d="M9.5 8V6h5v2" />
        <line x1="10.5" y1="10" x2="13.5" y2="10" />
      </>
    ),
    boat: (
      <>
        <path d="M3.5 14h17l-2 4a2 2 0 0 1-1.7 1H7.2a2 2 0 0 1-1.7-1Z" />
        <line x1="12" y1="5" x2="12" y2="14" />
        <path d="M12 6l5 6h-5Z" />
        <path d="M3 20.5q2 1 4 0t4 0 4 0 4 0" />
      </>
    ),
    skewer: (
      <>
        <line x1="5" y1="18.5" x2="19" y2="5.5" />
        <circle cx="9" cy="14.5" r="1.7" fill="currentColor" stroke="none" />
        <circle cx="12" cy="11.5" r="1.7" fill="currentColor" stroke="none" />
        <circle cx="15" cy="8.5" r="1.7" fill="currentColor" stroke="none" />
      </>
    ),
    lantern: (
      <>
        <rect x="10" y="4" width="4" height="2" rx="0.5" />
        <path d="M12 6c-4 0-4.5 3-4.5 5s0.5 5 4.5 5 4.5-3 4.5-5-0.5-5-4.5-5Z" />
        <line x1="8" y1="11" x2="16" y2="11" />
        <line x1="12" y1="16" x2="12" y2="19.5" />
      </>
    ),
    drum: (
      <>
        <ellipse cx="12" cy="8" rx="6" ry="2.2" />
        <line x1="6" y1="8" x2="6" y2="15" />
        <line x1="18" y1="8" x2="18" y2="15" />
        <path d="M6 15a6 2.2 0 0 0 12 0" />
        <path d="M6.5 9.5l11 4M6.5 13.5l11-4" />
        <line x1="14.5" y1="3.5" x2="18.5" y2="8.5" />
      </>
    ),
    water: (
      <>
        <path d="M3 9q3-3 6 0t6 0 6 0" />
        <path d="M3 14q3-3 6 0t6 0 6 0" />
        <path d="M3 19q3-3 6 0t6 0 6 0" />
      </>
    ),
    sprout: (
      <>
        <line x1="12" y1="21" x2="12" y2="11" />
        <path d="M12 14C8 14 6.5 12 6 8.5 10 9 11.5 11 12 14Z" />
        <path d="M12 12c4 0 5.5-2 6-5.5-4 0.5-5.5 2.5-6 5.5Z" />
        <line x1="7.5" y1="21" x2="16.5" y2="21" />
      </>
    ),
    map: (
      <>
        <path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2Z" />
        <line x1="9" y1="4" x2="9" y2="18" />
        <line x1="15" y1="6" x2="15" y2="20" />
        <circle cx="12" cy="11" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    note: (
      <>
        <path d="M6 3h8l4 4v14H6Z" />
        <path d="M14 3v4h4" />
        <line x1="8.5" y1="11" x2="15.5" y2="11" />
        <line x1="8.5" y1="14" x2="15.5" y2="14" />
        <line x1="8.5" y1="17" x2="13" y2="17" />
      </>
    ),
    bottle: (
      <>
        <path d="M10 3h4v3l1.4 2.4a3 3 0 0 1 .6 1.8V19a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-8.8a3 3 0 0 1 .6-1.8L10 6Z" />
        <line x1="8" y1="13" x2="16" y2="13" />
      </>
    ),
    core: (
      <>
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="3" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
      </>
    ),
    door: (
      <>
        <path d="M14 21V3.5L6 5.5V21" />
        <line x1="4" y1="21" x2="20" y2="21" />
        <line x1="14" y1="3.5" x2="20" y2="3.5" />
        <line x1="20" y1="3.5" x2="20" y2="21" />
        <circle cx="11.4" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        <circle cx="12" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
        <line x1="12" y1="15.5" x2="12" y2="17.5" />
      </>
    ),
    flag: (
      <>
        <line x1="6" y1="3" x2="6" y2="21" />
        <path d="M6 4h11l-2.5 3.5L17 11H6Z" />
      </>
    ),
    grid: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="1.5" />
        <line x1="4" y1="9.3" x2="20" y2="9.3" />
        <line x1="4" y1="14.6" x2="20" y2="14.6" />
        <line x1="9.3" y1="4" x2="9.3" y2="20" />
        <line x1="14.6" y1="4" x2="14.6" y2="20" />
        <rect x="9.3" y="9.3" width="5.3" height="5.3" fill="currentColor" stroke="none" opacity="0.5" />
      </>
    ),
    flower: (
      <>
        <circle cx="12" cy="12" r="2" />
        <path d="M12 10c-1-2.5-4-2.5-4 0s3 4 4 4 4-1.5 4-4-3-2.5-4 0Z" opacity="0.9" />
        <path d="M10 12c-2.5-1-2.5-4 0-4s4 3 4 4-1.5 4-4 4-2.5-3 0-4Z" opacity="0.9" />
        <line x1="12" y1="17" x2="12" y2="22" />
        <path d="M12 20c1.5 0 2.5-1 2.5-2.5" />
      </>
    ),
    wash: (
      <>
        <path d="M5 11h14v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3Z" />
        <line x1="4" y1="11" x2="20" y2="11" />
        <path d="M12 11V6a2 2 0 0 1 4 0" />
        <line x1="8" y1="14.5" x2="8" y2="16" />
        <line x1="11" y1="14.5" x2="11" y2="16.5" />
        <line x1="14" y1="14.5" x2="14" y2="16" />
      </>
    ),
    recycle: (
      <>
        <path d="M7 19H4.8a1.83 1.83 0 0 1-1.57-.88 1.79 1.79 0 0 1 0-1.79L7.2 9.5" />
        <path d="M11 19h8.2a1.83 1.83 0 0 0 1.56-.89 1.78 1.78 0 0 0 0-1.78l-1.23-2.12" />
        <path d="m14 16-3 3 3 3" />
        <path d="M8.29 13.6 7.2 9.5 3.1 10.6" />
        <path d="m9.34 5.81 1.1-1.89A1.83 1.83 0 0 1 12 3a1.78 1.78 0 0 1 1.55.89l3.94 6.84" />
        <path d="m13.38 9.63 4.1 1.1 1.1-4.1" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {inner[name] ?? null}
    </svg>
  );
}

/** Fisher–Yates shuffle returning a new array. */
function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Default emoji palette for the Symbol Lock (8 distinct "glyphs"). */
const SYMBOL_GLYPHS = ["🔴", "🔷", "🔺", "⭐", "🟩", "🟣", "➕", "⬛"];

/* --- Crossword: tap each answer into its numbered row; a gold column spells a
   secret word (ported from the Android `Crossword`). ------------------- */
function CrosswordPuzzle({ puzzle, solved, onSolved }: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "crossword" }>>) {
  const rows = puzzle.rows;
  const gridCols = useMemo(() => Math.max(...rows.map((r) => r.offset + r.word.length)), [rows]);
  const trayOrder = useMemo(() => shuffleArr(rows.map((_, i) => i)), [rows]);
  const [placed, setPlaced] = useState<(number | null)[]>(() => rows.map(() => null));
  const [picked, setPicked] = useState<number | null>(null);

  const display = solved ? rows.map((_, i) => i) : placed;
  const rowOfWord = (w: number) => display.findIndex((p) => p === w);
  const complete = rows.every((_, r) => placed[r] === r);

  useEffect(() => {
    if (complete && !solved) onSolved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);

  function tapTray(w: number) {
    if (solved) return;
    setPicked((p) => (p === w ? null : w));
  }
  function tapRow(r: number) {
    if (solved) return;
    if (placed[r] != null) {
      setPlaced((p) => p.map((x, i) => (i === r ? null : x)));
      return;
    }
    if (picked == null) return;
    setPlaced((p) => p.map((x, i) => (i === r ? picked : x === picked ? null : x)));
    setPicked(null);
  }

  return (
    <div className="mt-4 text-center">
      {puzzle.emoji && <div className="text-4xl">{puzzle.emoji}</div>}
      <p className="mt-2 font-fun text-base font-700 text-slate-800">{puzzle.prompt}</p>

      <div className="mt-4 flex justify-center overflow-x-auto">
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
          {rows.map((row, r) => (
            <Fragment key={r}>
              {Array.from({ length: gridCols }).map((_, c) => {
                const within = c >= row.offset && c < row.offset + row.word.length;
                if (!within) return <span key={c} className="h-8 w-8 sm:h-9 sm:w-9" />;
                const w = display[r];
                const ch = w != null ? rows[w].word[c - row.offset] ?? "" : "";
                const isSecret = c === puzzle.secretCol;
                return (
                  <button
                    key={c}
                    onClick={() => tapRow(r)}
                    disabled={solved}
                    className={`relative flex h-8 w-8 items-center justify-center rounded-md font-mono text-sm font-700 ring-1 transition disabled:cursor-default sm:h-9 sm:w-9 ${
                      isSecret
                        ? "bg-sunny/70 text-slate-900 ring-amber-400"
                        : w != null
                          ? "bg-mint/20 text-emerald-800 ring-emerald-200"
                          : "bg-amber-50 text-slate-400 ring-amber-100 hover:bg-amber-100"
                    }`}
                  >
                    {c === row.offset && <span className="absolute left-0.5 top-0 text-[8px] leading-none text-slate-400">{row.num}</span>}
                    {ch}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {solved ? (
        <p className="mt-3 font-fun text-sm font-700 text-amber-600">⭐ The gold column spells {puzzle.secret.toUpperCase()}</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {trayOrder.map((w) =>
              rowOfWord(w) >= 0 ? null : (
                <button
                  key={w}
                  onClick={() => tapTray(w)}
                  className={`rounded-xl px-3 py-2 font-fun text-sm font-700 ring-2 transition ${
                    picked === w ? "scale-105 bg-coral text-white ring-coral" : "bg-white text-slate-700 ring-amber-200 hover:bg-amber-50"
                  }`}
                >
                  {rows[w].word}
                </button>
              ),
            )}
          </div>
          {rows.some((row) => row.clue) && (
            <div className="mx-auto mt-3 grid max-w-sm gap-1 text-left text-xs text-slate-500">
              {rows.map((row) =>
                row.clue ? (
                  <p key={row.num}>
                    <span className="font-700 text-slate-600">{row.num}.</span> {row.clue}
                  </p>
                ) : null,
              )}
            </div>
          )}
          <p className="mt-3 font-round text-xs text-slate-400">Tap a word, then tap its numbered row. Tap a filled row to take the word back.</p>
        </>
      )}
    </div>
  );
}

/* --- Unscramble: tap the shuffled letter tiles in order to spell each word,
   one word at a time (ported from the Android `Unscramble`). ----------- */
function UnscramblePuzzle({ puzzle, solved, onSolved, onWrong }: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "unscramble" }>>) {
  const words = useMemo(() => puzzle.words.map((w) => w.toUpperCase()), [puzzle.words]);
  const [wi, setWi] = useState(0);
  const [typed, setTyped] = useState<number[]>([]); // scrambled-tile indices, in tap order
  const [bad, setBad] = useState(false);
  const wiSafe = Math.min(wi, words.length - 1);
  const word = words[wiSafe];
  const scrambled = useMemo(() => {
    let s: string[];
    do {
      s = shuffleArr(word.split(""));
    } while (s.join("") === word && word.length > 1);
    return s;
  }, [word]);
  const used = new Set(typed);

  function tapTile(i: number) {
    if (solved || used.has(i) || typed.length >= word.length) return;
    const next = [...typed, i];
    setTyped(next);
    if (next.length === word.length) {
      if (next.map((k) => scrambled[k]).join("") === word) {
        if (wi + 1 >= words.length) onSolved();
        else {
          setWi(wi + 1);
          setTyped([]);
        }
      } else {
        onWrong();
        setBad(true);
        setTimeout(() => {
          setTyped([]);
          setBad(false);
        }, 500);
      }
    }
  }

  return (
    <div className="mt-4 text-center">
      {puzzle.emoji && <div className="text-4xl">{puzzle.emoji}</div>}
      <p className="mt-2 font-fun text-base font-700 text-slate-800">{puzzle.prompt}</p>
      {words.length > 1 && (
        <p className="mt-1 font-fun text-sm font-700 text-slate-400">
          Word {wiSafe + 1} of {words.length}
        </p>
      )}
      {puzzle.clues?.[wiSafe] && <p className="mt-2 font-round text-sm text-amber-600">Clue: {puzzle.clues[wiSafe]}</p>}

      {/* Answer slots */}
      <div className={`mt-4 flex justify-center gap-1.5 ${bad ? "animate-pulse" : ""}`}>
        {word.split("").map((_, i) => (
          <button
            key={i}
            onClick={() => !solved && setTyped((t) => (i === t.length - 1 ? t.slice(0, -1) : t))}
            disabled={solved}
            className={`flex h-11 w-11 items-center justify-center rounded-xl font-mono text-xl font-700 ring-2 transition ${
              bad ? "bg-coral/15 text-coral ring-coral/40" : i < typed.length ? "bg-mint/20 text-emerald-800 ring-emerald-200" : "bg-slate-100 text-slate-400 ring-slate-200"
            }`}
          >
            {solved ? word[i] : typed[i] != null ? scrambled[typed[i]] : ""}
          </button>
        ))}
      </div>

      {/* Letter tiles */}
      {!solved && (
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {scrambled.map((ch, i) =>
            used.has(i) ? (
              <span key={i} className="h-11 w-11 rounded-xl bg-slate-50 ring-1 ring-slate-100" />
            ) : (
              <button
                key={i}
                onClick={() => tapTile(i)}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-white font-mono text-xl font-700 text-slate-700 ring-2 ring-amber-200 transition hover:scale-105 hover:bg-amber-50"
              >
                {ch}
              </button>
            ),
          )}
        </div>
      )}
      <p className="mt-3 font-round text-xs text-slate-400">Tap the letters in order. Tap the last filled box to take it back.</p>
    </div>
  );
}

/* --- Symbol Lock: read the letter→symbol key, then tap the symbols to spell
   the secret word (ported from the Android `SymbolLock`). -------------- */
function SymbolLockPuzzle({ puzzle, solved, onSolved, onWrong }: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "symbol-lock" }>>) {
  const word = puzzle.word.toUpperCase();
  const symbols = puzzle.symbols ?? SYMBOL_GLYPHS;
  const decoys = puzzle.decoys ?? 3;
  const letters = useMemo(() => Array.from(new Set(word.split(""))), [word]);
  const { glyphOf, palette, target } = useMemo(() => {
    const order = shuffleArr(symbols.map((_, i) => i));
    const map = new Map<string, string>();
    letters.forEach((ch, i) => map.set(ch, symbols[order[i % order.length]]));
    const tgt = word.split("").map((ch) => map.get(ch)!);
    const extra = order.slice(letters.length, letters.length + decoys).map((i) => symbols[i]);
    const pal = shuffleArr(Array.from(new Set([...tgt, ...extra])));
    return { glyphOf: map, palette: pal, target: tgt };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word]);
  const [entered, setEntered] = useState<string[]>([]);
  const [bad, setBad] = useState(false);

  function tap(g: string) {
    if (solved || entered.length >= word.length) return;
    const next = [...entered, g];
    setEntered(next);
    if (next.length === word.length) {
      if (next.join("|") === target.join("|")) onSolved();
      else {
        onWrong();
        setBad(true);
        setTimeout(() => {
          setEntered([]);
          setBad(false);
        }, 500);
      }
    }
  }

  const shown = solved ? target : entered;

  return (
    <div className="mt-4 text-center">
      {puzzle.emoji && <div className="text-4xl">{puzzle.emoji}</div>}
      <p className="mt-2 font-fun text-base font-700 text-slate-800">{puzzle.prompt}</p>

      <div className="mt-3 inline-block rounded-xl bg-mint/15 px-4 py-1.5 font-fun text-lg font-700 tracking-[0.3em] text-emerald-700 ring-1 ring-emerald-200">
        {word}
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {letters.map((ch) => (
          <span key={ch} className="flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 font-fun text-sm font-700 text-slate-600 ring-1 ring-amber-100">
            {ch} <span className="text-slate-400">=</span> <span className="text-xl">{glyphOf.get(ch)}</span>
          </span>
        ))}
      </div>

      <div className="mt-4 flex justify-center gap-2">
        {word.split("").map((_, i) => (
          <button
            key={i}
            onClick={() => !solved && setEntered((e) => e.slice(0, -1))}
            disabled={solved}
            className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ring-2 transition ${
              bad ? "bg-coral/15 ring-coral/40" : "bg-slate-100 ring-slate-200"
            }`}
          >
            {shown[i] ?? ""}
          </button>
        ))}
      </div>

      {!solved && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {palette.map((g, i) => (
            <button
              key={i}
              onClick={() => tap(g)}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-2xl ring-2 ring-amber-200 transition hover:scale-105 hover:bg-amber-50"
            >
              {g}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Renders the active puzzle and reports solved / wrong attempts to the parent. */
function PuzzleView({
  puzzle,
  solved,
  hiddenWords,
  wordHints,
  showCoords,
  orderUnlocked,
  onSolved,
  onWrong,
}: {
  puzzle: EscapeRoomPuzzle;
  solved: boolean;
  /** Word-search targets not yet lit up by another machine (shown as ❓). */
  hiddenWords?: Set<string>;
  /** Picture (emoji) clue to show for each revealed word instead of its text. */
  wordHints?: Map<string, string>;
  /** Show numbered Column/Row axes on a word search (for coordinate exits). */
  showCoords?: boolean;
  /** Trail maze: has the prerequisite "map" station been solved (route revealed)? */
  orderUnlocked?: boolean;
  onSolved: () => void;
  onWrong: () => void;
}) {
  if (puzzle.kind === "mcq") return <McqPuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
  if (puzzle.kind === "code") return <CodePuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
  if (puzzle.kind === "cipher")
    return <CipherPuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
  if (puzzle.kind === "circuit")
    return <CircuitPuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
  if (puzzle.kind === "sort")
    return <SortPuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
  if (puzzle.kind === "maze")
    return <MazePuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
  if (puzzle.kind === "trailmaze")
    return (
      <TrailMazePuzzle
        puzzle={puzzle}
        solved={solved}
        orderUnlocked={orderUnlocked}
        onSolved={onSolved}
        onWrong={onWrong}
      />
    );
  if (puzzle.kind === "fair")
    return <FairPuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
  if (puzzle.kind === "unscramble")
    return <UnscramblePuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
  if (puzzle.kind === "crossword")
    return <CrosswordPuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
  if (puzzle.kind === "symbol-lock")
    return <SymbolLockPuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
  if (puzzle.kind === "wordsearch")
    return (
      <WordSearchPuzzle
        puzzle={puzzle}
        solved={solved}
        hiddenWords={hiddenWords}
        wordHints={wordHints}
        showCoords={showCoords}
        onSolved={onSolved}
        onWrong={onWrong}
      />
    );
  return <OrderPuzzle puzzle={puzzle} solved={solved} onSolved={onSolved} onWrong={onWrong} />;
}

type PuzzleProps<T> = {
  puzzle: T;
  solved: boolean;
  onSolved: () => void;
  onWrong: () => void;
};

function McqPuzzle({ puzzle, solved, onSolved, onWrong }: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "mcq" }>>) {
  const [wrongPicks, setWrongPicks] = useState<number[]>([]);

  function pick(i: number) {
    if (solved) return;
    if (i === puzzle.answerIndex) onSolved();
    else if (!wrongPicks.includes(i)) {
      setWrongPicks((w) => [...w, i]);
      onWrong();
    }
  }

  return (
    <div className="mt-4 text-center">
      {puzzle.emoji && <div className="text-5xl">{puzzle.emoji}</div>}
      <p className="mt-3 font-fun text-lg font-700 text-slate-800">{puzzle.prompt}</p>
      <div className="mt-4 grid gap-3">
        {puzzle.options.map((opt, i) => {
          const isAnswer = i === puzzle.answerIndex;
          const isWrong = wrongPicks.includes(i);
          const cls =
            solved && isAnswer
              ? "bg-mint/30 text-emerald-700 ring-emerald-300"
              : isWrong
                ? "bg-coral/15 text-coral/70 ring-coral/30 line-through"
                : "bg-amber-50 text-slate-700 ring-amber-100 hover:bg-amber-100";
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={solved || isWrong}
              className={`rounded-2xl px-5 py-4 font-fun text-base font-700 ring-2 transition disabled:cursor-not-allowed ${cls}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CodePuzzle({ puzzle, solved, onSolved, onWrong }: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "code" }>>) {
  const [value, setValue] = useState("");
  const [shake, setShake] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (solved) return;
    if (value.trim().toLowerCase() === puzzle.answer.trim().toLowerCase()) onSolved();
    else {
      onWrong();
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 text-center">
      {puzzle.emoji && <div className="text-5xl">{puzzle.emoji}</div>}
      <p className="mt-3 font-fun text-lg font-700 text-slate-800">{puzzle.prompt}</p>
      <div className="mt-4 inline-block rounded-2xl bg-slate-900 px-6 py-3 font-mono text-2xl font-700 tracking-widest text-mint">
        {puzzle.clue}
      </div>
      <div className="mt-5 flex justify-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={solved}
          placeholder="Type the code"
          aria-label="Enter the code"
          className={`w-44 rounded-full border-2 px-5 py-2.5 text-center font-fun text-lg font-700 text-slate-800 outline-none transition ${
            shake ? "animate-pulse border-coral" : "border-amber-200 focus:border-coral"
          }`}
        />
        <button
          type="submit"
          disabled={solved || !value.trim()}
          className="rounded-full bg-coral px-6 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
        >
          Unlock 🔑
        </button>
      </div>
    </form>
  );
}

function OrderPuzzle({ puzzle, solved, onSolved, onWrong }: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "order" }>>) {
  const shuffled = useMemo(() => {
    const arr = puzzle.items.map((label, originalIndex) => ({ label, originalIndex }));
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [puzzle.items]);

  const [placed, setPlaced] = useState<number[]>([]);
  const [wrongTap, setWrongTap] = useState<number | null>(null);

  function tap(originalIndex: number) {
    if (solved || placed.includes(originalIndex)) return;
    if (originalIndex === placed.length) {
      const next = [...placed, originalIndex];
      setPlaced(next);
      setWrongTap(null);
      if (next.length === puzzle.items.length) onSolved();
    } else {
      onWrong();
      setWrongTap(originalIndex);
      setTimeout(() => setWrongTap((w) => (w === originalIndex ? null : w)), 500);
    }
  }

  return (
    <div className="mt-4 text-center">
      {puzzle.emoji && <div className="text-5xl">{puzzle.emoji}</div>}
      <p className="mt-3 font-fun text-lg font-700 text-slate-800">{puzzle.prompt}</p>
      <div className="mt-4 grid gap-2.5">
        {shuffled.map(({ label, originalIndex }) => {
          const order = placed.indexOf(originalIndex);
          const isPlaced = order !== -1;
          const isWrong = wrongTap === originalIndex;
          const cls = isPlaced
            ? "bg-mint/25 text-emerald-700 ring-emerald-300"
            : isWrong
              ? "bg-coral/15 text-coral ring-coral/40"
              : "bg-amber-50 text-slate-700 ring-amber-100 hover:bg-amber-100";
          return (
            <button
              key={originalIndex}
              onClick={() => tap(originalIndex)}
              disabled={solved || isPlaced}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left font-fun font-600 ring-2 transition disabled:cursor-default ${cls}`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/70 font-700 text-slate-500">
                {isPlaced ? order + 1 : "·"}
              </span>
              {label}
            </button>
          );
        })}
      </div>
      <p className="mt-3 font-round text-xs text-slate-400">Tap them in the right order.</p>
    </div>
  );
}

/**
 * Symbol decoder (substitution cipher): each symbol stands for its own letter
 * in the key, so there's nothing to spin through — the player has to look up
 * each coded symbol and type the word it spells.
 */
function CipherPuzzle({
  puzzle,
  solved,
  onSolved,
  onWrong,
}: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "cipher" }>>) {
  const [value, setValue] = useState("");
  const [shake, setShake] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (solved) return;
    if (value.trim().toUpperCase() === puzzle.answer.trim().toUpperCase()) onSolved();
    else {
      onWrong();
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  }

  return (
    <div className="mt-4 text-center">
      {puzzle.emoji && <div className="text-5xl">{puzzle.emoji}</div>}
      <p className="mt-3 font-fun text-lg font-700 text-slate-800">{puzzle.prompt}</p>

      {/* Decoder key: symbol → letter legend */}
      <div className="mx-auto mt-4 max-w-sm rounded-2xl bg-slate-900 p-4 ring-2 ring-slate-700">
        <p className="font-fun text-xs font-700 uppercase tracking-wider text-slate-400">🔑 Decoder Key</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {puzzle.symbols.map((sym, i) => (
            <div key={sym} className="flex flex-col items-center rounded-lg bg-slate-800 py-1.5">
              <span className="text-xl">{sym}</span>
              <span className="font-mono text-sm font-700 text-mint">{puzzle.letters[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Coded message */}
      <p className="mt-4 font-fun text-sm font-600 text-slate-500">The secret word reads:</p>
      <div className="mt-2 flex justify-center gap-2">
        {puzzle.coded.map((sym, k) => (
          <span
            key={k}
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-2xl ring-2 ring-amber-200"
          >
            {sym}
          </span>
        ))}
      </div>

      {/* Type the decoded word */}
      <form onSubmit={submit} className="mt-4 flex justify-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          disabled={solved}
          placeholder="Type the word"
          aria-label="Type the decoded word"
          className={`w-44 rounded-full border-2 px-5 py-2.5 text-center font-fun text-lg font-700 uppercase tracking-widest text-slate-800 outline-none transition ${
            shake ? "animate-pulse border-coral" : "border-amber-200 focus:border-coral"
          }`}
        />
        <button
          type="submit"
          disabled={solved || !value.trim()}
          className="rounded-full bg-coral px-6 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
        >
          Decode 🔓
        </button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Circuit connector — rotate pipes to link the power to the bulb      */
/* ------------------------------------------------------------------ */

const DIR_SEQ: Dir[] = ["N", "E", "S", "W"];
const DIR_VEC: Record<Dir, [number, number]> = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
const DIR_OPP: Record<Dir, Dir> = { N: "S", E: "W", S: "N", W: "E" };

/** Rotate a tile's open sides `rot` quarter-turns clockwise. */
function rotateSides(sides: Dir[], rot: number): Dir[] {
  return sides.map((d) => DIR_SEQ[(DIR_SEQ.indexOf(d) + rot) % 4]);
}

function CircuitPuzzle({
  puzzle,
  solved,
  onSolved,
}: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "circuit" }>>) {
  const rows = puzzle.tiles.length;
  const cols = puzzle.tiles[0].length;
  const [rots, setRots] = useState<number[][]>(() => puzzle.tiles.map((row) => row.map((t) => ((t.rot % 4) + 4) % 4)));

  const sidesAt = (r: number, c: number) => rotateSides(puzzle.tiles[r][c].sides, rots[r][c]);

  // Flood-fill from the power source; collect every cell it reaches.
  const powered = useMemo(() => {
    const seen = new Set<string>();
    const start = puzzle.start;
    if (!rotateSides(puzzle.tiles[start.r][start.c].sides, rots[start.r][start.c]).includes(start.from)) return seen;
    const queue: [number, number][] = [[start.r, start.c]];
    seen.add(`${start.r},${start.c}`);
    while (queue.length) {
      const [r, c] = queue.shift()!;
      for (const d of rotateSides(puzzle.tiles[r][c].sides, rots[r][c])) {
        const [dr, dc] = DIR_VEC[d];
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        if (!rotateSides(puzzle.tiles[nr][nc].sides, rots[nr][nc]).includes(DIR_OPP[d])) continue;
        const k = `${nr},${nc}`;
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push([nr, nc]);
      }
    }
    return seen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rots, puzzle, rows, cols]);

  const lit =
    powered.has(`${puzzle.end.r},${puzzle.end.c}`) && sidesAt(puzzle.end.r, puzzle.end.c).includes(puzzle.end.to);

  useEffect(() => {
    if (lit && !solved) onSolved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lit, solved]);

  function tap(r: number, c: number) {
    if (solved) return;
    setRots((prev) => prev.map((row, rr) => row.map((v, cc) => (rr === r && cc === c ? (v + 1) % 4 : v))));
  }

  const bar = (on: boolean) => (on ? "bg-amber-400" : "bg-slate-300");

  // A short stub on a tile's outer edge, marking where power enters (start) or
  // leaves (end) the grid — so direction is clear without flanking icons.
  const edgeNub = (edge: Dir, color: string) => {
    const base = `absolute rounded-full ${color}`;
    switch (edge) {
      case "N":
        return <span className={`${base} left-1/2 -top-1 h-2 w-2 -translate-x-1/2`} />;
      case "S":
        return <span className={`${base} left-1/2 -bottom-1 h-2 w-2 -translate-x-1/2`} />;
      case "E":
        return <span className={`${base} top-1/2 -right-1 h-2 w-2 -translate-y-1/2`} />;
      case "W":
        return <span className={`${base} top-1/2 -left-1 h-2 w-2 -translate-y-1/2`} />;
    }
  };

  return (
    <div className="mt-4 text-center">
      {puzzle.emoji && <div className="text-5xl">{puzzle.emoji}</div>}
      <p className="mt-3 font-fun text-lg font-700 text-slate-800">{puzzle.prompt}</p>

      <div className="mt-4 flex items-center justify-center">
        <div
          className="grid gap-1 rounded-2xl bg-slate-900 p-2"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {puzzle.tiles.map((row, r) =>
            row.map((_, c) => {
              const on = powered.has(`${r},${c}`);
              const sides = sidesAt(r, c);
              const isStart = r === puzzle.start.r && c === puzzle.start.c;
              const isEnd = r === puzzle.end.r && c === puzzle.end.c;
              return (
                <button
                  key={`${r},${c}`}
                  onClick={() => tap(r, c)}
                  disabled={solved}
                  aria-label={`Pipe ${r + 1},${c + 1}${isStart ? " (power source)" : isEnd ? " (lamp)" : ""}`}
                  className={`relative h-12 w-12 rounded-md ring-1 transition disabled:cursor-default sm:h-14 sm:w-14 ${
                    isStart
                      ? "bg-amber-500/25 ring-amber-400/70"
                      : isEnd
                        ? lit
                          ? "bg-amber-300/30 ring-amber-300/70"
                          : "bg-slate-700/60 ring-slate-500"
                        : "bg-slate-800 ring-slate-700 hover:bg-slate-700"
                  }`}
                >
                  {/* centre hub */}
                  <span
                    className={`absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${bar(on)}`}
                  />
                  {sides.includes("N") && (
                    <span className={`absolute left-1/2 top-0 h-1/2 w-2 -translate-x-1/2 rounded-full ${bar(on)}`} />
                  )}
                  {sides.includes("S") && (
                    <span className={`absolute bottom-0 left-1/2 h-1/2 w-2 -translate-x-1/2 rounded-full ${bar(on)}`} />
                  )}
                  {sides.includes("E") && (
                    <span className={`absolute right-0 top-1/2 h-2 w-1/2 -translate-y-1/2 rounded-full ${bar(on)}`} />
                  )}
                  {sides.includes("W") && (
                    <span className={`absolute left-0 top-1/2 h-2 w-1/2 -translate-y-1/2 rounded-full ${bar(on)}`} />
                  )}
                  {isStart && edgeNub(puzzle.start.from, "bg-amber-400")}
                  {isEnd && edgeNub(puzzle.end.to, lit ? "bg-amber-400" : "bg-slate-400")}
                  {isStart && (
                    <span className="absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-[10px] shadow ring-1 ring-amber-400/70">
                      ⚡
                    </span>
                  )}
                  {isEnd && (
                    <span className={`absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-[10px] shadow ring-1 transition ${lit ? "ring-amber-400/70" : "ring-slate-500 grayscale"}`}>
                      💡
                    </span>
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>

      <p className="mt-3 font-round text-xs text-slate-400">
        {lit ? "💡 Lit! Clean power is flowing." : "Tap a tile to spin it. Connect the ⚡ source to the 💡 lamp."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sort — drop statements into the right bin                           */
/* ------------------------------------------------------------------ */

function SortPuzzle({ puzzle, solved, onSolved, onWrong }: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "sort" }>>) {
  const [placed, setPlaced] = useState<Record<number, number>>({});
  const [shakeIdx, setShakeIdx] = useState<number | null>(null);

  function drop(i: number, bin: number) {
    if (solved || placed[i] !== undefined) return;
    if (puzzle.items[i].bin === bin) {
      const next = { ...placed, [i]: bin };
      setPlaced(next);
      if (puzzle.items.every((_, k) => next[k] !== undefined)) onSolved();
    } else {
      onWrong();
      setShakeIdx(i);
      setTimeout(() => setShakeIdx((s) => (s === i ? null : s)), 450);
    }
  }

  return (
    <div className="mt-4 text-center">
      {puzzle.emoji && <div className="text-5xl">{puzzle.emoji}</div>}
      <p className="mt-3 font-fun text-lg font-700 text-slate-800">{puzzle.prompt}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {puzzle.bins.map((b, bi) => (
          <div
            key={bi}
            className="rounded-2xl bg-amber-50 py-2 font-fun text-sm font-700 text-slate-600 ring-1 ring-amber-100"
          >
            {b.emoji} {b.label} bin
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2">
        {puzzle.items.map((it, i) => {
          const done = placed[i] !== undefined;
          if (done) {
            const b = puzzle.bins[placed[i]];
            return (
              <div
                key={i}
                className="rounded-2xl bg-mint/15 px-4 py-2.5 font-fun text-sm font-600 text-emerald-700 ring-1 ring-emerald-200"
              >
                {b.emoji} &ldquo;{it.text}&rdquo;
              </div>
            );
          }
          return (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-2xl bg-white px-3 py-2 ring-2 transition ${
                shakeIdx === i ? "animate-pulse ring-coral" : "ring-amber-100"
              }`}
            >
              <span className="flex-1 text-left font-fun text-sm font-600 text-slate-700">&ldquo;{it.text}&rdquo;</span>
              {puzzle.bins.map((b, bi) => (
                <button
                  key={bi}
                  onClick={() => drop(i, bi)}
                  disabled={solved}
                  aria-label={`Put in ${b.label} bin`}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-lg ring-1 ring-amber-100 transition hover:scale-110 hover:bg-amber-100"
                >
                  {b.emoji}
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <p className="mt-3 font-round text-xs text-slate-400">Tap a bin button to drop each statement in.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared maze keyboard controls (arrow keys / WASD)                    */
/* ------------------------------------------------------------------ */

/**
 * Arrow-keys / WASD movement for the maze puzzles: a step on press, then
 * auto-walk while held. A live `moveRef` keeps the once-bound listener on the
 * latest closure. The room's own movement keys pause while a puzzle modal is
 * open, so there's no clash.
 */
function useMazeKeys(move: (dr: number, dc: number) => void) {
  const moveRef = useRef(move);
  moveRef.current = move;
  useEffect(() => {
    const DIRS: Record<string, [number, number]> = {
      arrowup: [-1, 0], w: [-1, 0],
      arrowdown: [1, 0], s: [1, 0],
      arrowleft: [0, -1], a: [0, -1],
      arrowright: [0, 1], d: [0, 1],
    };
    let dir: [number, number] | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
      dir = null;
    };
    const onDown = (e: KeyboardEvent) => {
      const d = DIRS[e.key.toLowerCase()];
      if (!d) return;
      e.preventDefault(); // don't scroll the page
      if (e.repeat) return; // we drive our own steady repeat
      dir = d;
      moveRef.current(d[0], d[1]);
      if (timer) clearInterval(timer);
      timer = setInterval(() => dir && moveRef.current(dir[0], dir[1]), 160);
    };
    const onUp = (e: KeyboardEvent) => {
      const d = DIRS[e.key.toLowerCase()];
      if (d && dir && d[0] === dir[0] && d[1] === dir[1]) stop();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      stop();
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);
}

/* ------------------------------------------------------------------ */
/* Maze — walk the honest path; lies dead-end                          */
/* ------------------------------------------------------------------ */

function MazePuzzle({ puzzle, solved, onSolved }: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "maze" }>>) {
  // Pick one maze from the pool, fixed for the lifetime of this puzzle view.
  const variant = useMemo(
    () => puzzle.variants[Math.floor(Math.random() * puzzle.variants.length)],
    [puzzle.variants],
  );
  const grid = variant.grid;
  const ends = useMemo(() => {
    let s: [number, number] = [1, 1];
    let g: [number, number] = [1, 1];
    grid.forEach((row, r) =>
      row.split("").forEach((ch, c) => {
        if (ch === "S") s = [r, c];
        if (ch === "G") g = [r, c];
      }),
    );
    return { s, g };
  }, [grid]);

  // The squares around a cell (3×3) — what the hero can see from there.
  const reveal = (p: [number, number]) => {
    const out: string[] = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const r = p[0] + dr;
        const c = p[1] + dc;
        if (r >= 0 && c >= 0 && r < grid.length && c < grid[0].length) out.push(`${r},${c}`);
      }
    return out;
  };

  const [pos, setPos] = useState(ends.s);
  const [seen, setSeen] = useState<Set<string>>(() => new Set(reveal(ends.s)));
  const atGoal = pos[0] === ends.g[0] && pos[1] === ends.g[1];

  useEffect(() => {
    if (atGoal && !solved) onSolved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atGoal, solved]);

  // Fog of war: light up the squares around the hero as they explore.
  useEffect(() => {
    setSeen((prev) => {
      const next = new Set(prev);
      reveal(pos).forEach((k) => next.add(k));
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  function move(dr: number, dc: number) {
    if (solved) return;
    const nr = pos[0] + dr;
    const nc = pos[1] + dc;
    if (nr < 0 || nc < 0 || nr >= grid.length || nc >= grid[0].length) return;
    if (grid[nr][nc] === "#") return;
    setPos([nr, nc]);
  }

  // Arrow keys / WASD walk the hero (shared with the trail maze).
  useMazeKeys(move);

  const sign = variant.signs?.find((s) => s.at[0] === pos[0] && s.at[1] === pos[1]);
  const dpad =
    "flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-xl ring-2 ring-amber-100 transition hover:bg-amber-100 disabled:opacity-40";

  return (
    <div className="mt-4 text-center">
      {puzzle.emoji && <div className="text-5xl">{puzzle.emoji}</div>}
      <p className="mt-3 font-fun text-lg font-700 text-slate-800">{puzzle.prompt}</p>

      {/* Maze on the left, controls on the right so the move pad stays in view
          without scrolling. Stacks on very narrow screens. */}
      <div className="mt-4 flex flex-col items-center justify-center gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div
          className="inline-grid gap-0.5 rounded-xl bg-slate-900 p-2"
          style={{ gridTemplateColumns: `repeat(${grid[0].length}, minmax(0, 1fr))` }}
        >
          {grid.map((row, r) =>
            row.split("").map((ch, c) => {
              const key = `${r},${c}`;
              const visible = seen.has(key);
              const isWall = ch === "#";
              const here = pos[0] === r && pos[1] === c;
              const isGoal = ch === "G";
              return (
                <div
                  key={key}
                  className={`flex h-6 w-6 items-center justify-center rounded-sm text-sm ${
                    !visible ? "bg-slate-950" : isWall ? "bg-slate-700" : "bg-slate-100"
                  }`}
                >
                  {visible ? (here ? "🦸" : isGoal ? puzzle.goalEmoji ?? "💙" : "") : ""}
                </div>
              );
            }),
          )}
        </div>

        {/* Controls column: signpost slot above the move pad. */}
        <div className="flex flex-col items-center">
          {/* Fixed-height slot so the move pad below never shifts when a
              signpost appears at an intersection. */}
          <div className="flex min-h-[5.5rem] w-44 items-center justify-center">
            {sign && !atGoal && (
              <div className="rounded-2xl bg-sky/10 p-3 font-round text-sm text-sky-800 ring-1 ring-sky/20">
                {sign.text}
              </div>
            )}
          </div>

          <div className="mt-1 inline-grid grid-cols-3 gap-1">
            <span />
            <button onClick={() => move(-1, 0)} disabled={solved} aria-label="Up" className={dpad}>
              ⬆️
            </button>
            <span />
            <button onClick={() => move(0, -1)} disabled={solved} aria-label="Left" className={dpad}>
              ⬅️
            </button>
            <span className="flex items-center justify-center font-fun text-[10px] font-700 text-slate-400">move</span>
            <button onClick={() => move(0, 1)} disabled={solved} aria-label="Right" className={dpad}>
              ➡️
            </button>
            <span />
            <button onClick={() => move(1, 0)} disabled={solved} aria-label="Down" className={dpad}>
              ⬇️
            </button>
            <span />
          </div>
        </div>
      </div>
      <p className="mt-2 font-round text-[11px] text-slate-400">
        Move with the arrows on screen, the ← ↑ ↓ → keys, or WASD.
      </p>
      <p className="mt-3 font-round text-xs text-slate-400">
        {atGoal
          ? puzzle.wonText ?? "💙 You reached the core the honest way!"
          : puzzle.caption ?? "Use the arrows to walk to 💙 — lies lead to dead ends."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trail maze — read the map, then walk the landmarks in order          */
/* ------------------------------------------------------------------ */

function TrailMazePuzzle({
  puzzle,
  solved,
  orderUnlocked,
  onSolved,
  onWrong,
}: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "trailmaze" }>> & { orderUnlocked?: boolean }) {
  const grid = puzzle.grid;
  // The route is only known once the prerequisite "map" station is solved.
  const unlocked = orderUnlocked !== false;
  const ends = useMemo(() => {
    let s: [number, number] = [1, 1];
    let g: [number, number] = [1, 1];
    grid.forEach((row, r) =>
      row.split("").forEach((ch, c) => {
        if (ch === "S") s = [r, c];
        if (ch === "G") g = [r, c];
      }),
    );
    return { s, g };
  }, [grid]);

  // The squares around a cell (3×3) — what the hero can see from there.
  const reveal = (p: [number, number]) => {
    const out: string[] = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const r = p[0] + dr;
        const c = p[1] + dc;
        if (r >= 0 && c >= 0 && r < grid.length && c < grid[0].length) out.push(`${r},${c}`);
      }
    return out;
  };

  const [pos, setPos] = useState(ends.s);
  const [seen, setSeen] = useState<Set<string>>(() => new Set(reveal(ends.s)));
  // How many route waypoints have been collected, in order (an index into `route`).
  const [step, setStep] = useState(0);
  const [nudge, setNudge] = useState<string | null>(null);

  const landmarkAt = (r: number, c: number) =>
    puzzle.landmarks.find((l) => l.at[0] === r && l.at[1] === c);
  const goalEmoji = puzzle.goalEmoji ?? "🚪";
  const allCollected = step >= puzzle.route.length;
  const atGoal = pos[0] === ends.g[0] && pos[1] === ends.g[1];
  const won = allCollected && atGoal;

  useEffect(() => {
    if (won && !solved) onSolved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won, solved]);

  // Fog of war: light up the squares around the hero as they explore the trail.
  useEffect(() => {
    setSeen((prev) => {
      const next = new Set(prev);
      reveal(pos).forEach((k) => next.add(k));
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  function move(dr: number, dc: number) {
    if (solved) return;
    const nr = pos[0] + dr;
    const nc = pos[1] + dc;
    if (nr < 0 || nc < 0 || nr >= grid.length || nc >= grid[0].length) return;
    if (grid[nr][nc] === "#") return;
    setPos([nr, nc]);

    // You can scout the maze freely, but the trail doesn't COUNT until the map is
    // read — so you can't luck into the right order (and the gate) before then.
    if (!unlocked) return;

    // Stepping onto a landmark: count it if it's the next one on the map's route.
    // A landmark already behind us (idx < step) is just scenery to walk back over;
    // a still-to-come one stepped on early gets a gentle out-of-order nudge.
    const lm = landmarkAt(nr, nc);
    if (lm && !allCollected) {
      const idx = puzzle.route.indexOf(lm.emoji);
      if (idx === step) {
        setStep((s) => s + 1);
        setNudge(null);
      } else if (idx > step) {
        setNudge(`Check the map — ${puzzle.route[step]} comes next!`);
        onWrong();
      }
    }
  }

  // Arrow keys / WASD walk the hero (shared with the honesty maze).
  useMazeKeys(move);

  const dpad =
    "flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-xl ring-2 ring-amber-100 transition hover:bg-amber-100 disabled:opacity-40";

  return (
    <div className="mt-4 text-center">
      {puzzle.emoji && <div className="text-5xl">{puzzle.emoji}</div>}
      <p className="mt-3 font-fun text-lg font-700 text-slate-800">{puzzle.prompt}</p>

      {/* The map: the route's landmarks with connector arrows; locked until the
          prerequisite map station is solved (then each ticks green in order). */}
      <div className="mx-auto mt-4 flex max-w-md flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200">
        <span className="mr-1 font-fun text-sm font-700 text-emerald-700">🗺️ Map:</span>
        {puzzle.route.map((emoji, i) => {
          const done = i < step;
          const next = i === step && !allCollected;
          return (
            <span key={i} className="flex items-center gap-1.5">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl text-xl transition ${
                  !unlocked
                    ? "bg-slate-100 text-slate-400 ring-1 ring-slate-200"
                    : done
                      ? "bg-emerald-500/20 ring-2 ring-emerald-500"
                      : next
                        ? "bg-white ring-2 ring-amber-300"
                        : "bg-white/60 ring-1 ring-slate-200 grayscale"
                }`}
              >
                {unlocked ? emoji : "❓"}
              </span>
              {unlocked && done && <span className="text-emerald-600">✓</span>}
              {i < puzzle.route.length - 1 && <span className="text-slate-300">→</span>}
            </span>
          );
        })}
        <span className="text-slate-300">→</span>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl text-xl ${
            unlocked && allCollected ? "bg-white ring-2 ring-amber-300" : "bg-white/60 ring-1 ring-slate-200 grayscale"
          }`}
        >
          {goalEmoji}
        </span>
      </div>

      <>
          {/* The maze is always explorable, but landmarks only count once the map
              is read — scouting while locked can't luck you into the exit. */}
          <div className="mt-4 flex flex-col items-center justify-center gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div
              className="inline-grid gap-0.5 rounded-xl bg-emerald-950 p-2"
              style={{ gridTemplateColumns: `repeat(${grid[0].length}, minmax(0, 1fr))` }}
            >
              {grid.map((row, r) =>
                row.split("").map((ch, c) => {
                  const key = `${r},${c}`;
                  const visible = seen.has(key);
                  const isWall = ch === "#";
                  const here = pos[0] === r && pos[1] === c;
                  const isGoal = ch === "G";
                  const lm = landmarkAt(r, c);
                  // A landmark is "done" once the route has advanced past it.
                  const lmDone = lm != null && puzzle.route.indexOf(lm.emoji) < step;
                  return (
                    <div
                      key={key}
                      className={`flex h-6 w-6 items-center justify-center rounded-sm text-sm ${
                        !visible ? "bg-emerald-950" : isWall ? "bg-emerald-800" : "bg-lime-50"
                      } ${visible && lmDone ? "ring-1 ring-emerald-400" : ""}`}
                    >
                      {!visible
                        ? ""
                        : here
                          ? "🚶"
                          : isGoal
                            ? goalEmoji
                            : lm
                              ? <span className={lmDone ? "opacity-40" : ""}>{lm.emoji}</span>
                              : ""}
                    </div>
                  );
                }),
              )}
            </div>

            {/* Controls column: nudge slot above a fixed move pad. */}
            <div className="flex flex-col items-center">
              <div className="flex min-h-[5.5rem] w-44 items-center justify-center">
                {nudge && !won && (
                  <div className="rounded-2xl bg-coral/10 p-3 font-round text-sm text-coral ring-1 ring-coral/20">
                    {nudge}
                  </div>
                )}
              </div>

              <div className="mt-1 inline-grid grid-cols-3 gap-1">
                <span />
                <button onClick={() => move(-1, 0)} disabled={solved} aria-label="Up" className={dpad}>
                  ⬆️
                </button>
                <span />
                <button onClick={() => move(0, -1)} disabled={solved} aria-label="Left" className={dpad}>
                  ⬅️
                </button>
                <span className="flex items-center justify-center font-fun text-[10px] font-700 text-slate-400">walk</span>
                <button onClick={() => move(0, 1)} disabled={solved} aria-label="Right" className={dpad}>
                  ➡️
                </button>
                <span />
                <button onClick={() => move(1, 0)} disabled={solved} aria-label="Down" className={dpad}>
                  ⬇️
                </button>
                <span />
              </div>
            </div>
          </div>
          <p className="mt-2 font-round text-[11px] text-slate-400">
            Move with the arrows on screen, the ← ↑ ↓ → keys, or WASD.
          </p>
          <p className="mt-3 font-round text-xs text-slate-400">
            {!unlocked
              ? "🔒 Scout the trail if you like — but read the Trail Map to learn the order before you can finish."
              : won
                ? puzzle.wonText ?? "🗺️ You followed the map and walked the whole trail!"
                : allCollected
                  ? `All landmarks found — now reach the ${goalEmoji}!`
                  : puzzle.caption ?? "Read the map, then walk the landmarks in order."}
          </p>
        </>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fair — share the treats equally among the animals                   */
/* ------------------------------------------------------------------ */

function FairPuzzle({ puzzle, solved, onSolved }: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "fair" }>>) {
  const [counts, setCounts] = useState<number[]>(() => puzzle.animals.map(() => 0));
  const given = counts.reduce((a, b) => a + b, 0);
  const left = puzzle.total - given;
  const fair = left === 0 && counts.every((c) => c === counts[0]);

  useEffect(() => {
    if (fair && !solved) onSolved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fair, solved]);

  function give(i: number, delta: number) {
    if (solved) return;
    setCounts((prev) => {
      const total = prev.reduce((a, b) => a + b, 0);
      if (delta > 0 && total >= puzzle.total) return prev;
      const v = prev[i] + delta;
      if (v < 0) return prev;
      const next = [...prev];
      next[i] = v;
      return next;
    });
  }

  const stepBtn =
    "flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 font-fun text-xl font-700 text-slate-600 ring-1 ring-amber-200 transition hover:bg-amber-200 disabled:opacity-30";

  return (
    <div className="mt-4 text-center">
      {puzzle.emoji && <div className="text-5xl">{puzzle.emoji}</div>}
      <p className="mt-3 font-fun text-lg font-700 text-slate-800">{puzzle.prompt}</p>

      <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-amber-50 px-4 py-1.5 font-fun text-sm font-700 text-slate-600 ring-1 ring-amber-100">
        {puzzle.treat} {left} left to share
      </div>

      <div className="mt-4 grid gap-3">
        {puzzle.animals.map((a, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2 ring-1 ring-amber-100">
            <span className="text-3xl">{a}</span>
            <div className="flex min-h-[1.75rem] flex-1 flex-wrap content-center justify-center gap-0.5 text-lg">
              {Array.from({ length: counts[i] }).map((_, k) => (
                <span key={k}>{puzzle.treat}</span>
              ))}
            </div>
            <button onClick={() => give(i, -1)} disabled={solved || counts[i] === 0} aria-label="Take one" className={stepBtn}>
              −
            </button>
            <button onClick={() => give(i, 1)} disabled={solved || left === 0} aria-label="Give one" className={stepBtn}>
              +
            </button>
          </div>
        ))}
      </div>
      <p className="mt-3 font-round text-xs text-slate-400">
        {fair ? "💛 Perfectly fair — everyone got the same!" : "Give every animal the same number, and use all the treats."}
      </p>
    </div>
  );
}

function WordSearchPuzzle({
  puzzle,
  solved,
  hiddenWords,
  wordHints,
  showCoords,
  onSolved,
  onWrong,
}: PuzzleProps<Extract<EscapeRoomPuzzle, { kind: "wordsearch" }>> & {
  hiddenWords?: Set<string>;
  wordHints?: Map<string, string>;
  showCoords?: boolean;
}) {
  // A fixed `layout` (deterministic puzzles) wins over the random generator.
  const grid = useMemo(
    () => puzzle.layout ?? generateWordGrid(puzzle.words, puzzle.size),
    [puzzle.layout, puzzle.words, puzzle.size],
  );
  const targets = useMemo(() => puzzle.words.map((w) => w.toUpperCase().replace(/[^A-Z]/g, "")), [puzzle.words]);
  // "Secret" words show as ❓ in the list (the player works them out from a clue
  // elsewhere) but stay searchable and don't keep the grid scrambled.
  const secretSet = useMemo(
    () => new Set((puzzle.secret ?? []).map((w) => w.toUpperCase().replace(/[^A-Z]/g, ""))),
    [puzzle.secret],
  );
  const hidden = hiddenWords ?? new Set<string>();
  const anyHidden = targets.some((t) => hidden.has(t));
  const withAxes = !!showCoords && !!puzzle.intersection;
  const crossKey = puzzle.intersection ? `${puzzle.intersection[0]},${puzzle.intersection[1]}` : null;

  const [first, setFirst] = useState<[number, number] | null>(null);
  const [found, setFound] = useState<string[]>([]);
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set());
  const [badCells, setBadCells] = useState<Set<string>>(new Set());

  const allFound = found.length === targets.length;
  // Until every word's clue is revealed, the poster is scrambled (blurred and
  // unsearchable) — so you can't read the words straight off the grid before
  // solving the machines that light them up.
  const obscured = anyHidden;
  const revealedCount = targets.length - hidden.size;

  function lineCells(a: [number, number], b: [number, number]): [number, number][] | null {
    const [r1, c1] = a;
    const [r2, c2] = b;
    const straight = r1 === r2 || c1 === c2 || Math.abs(r2 - r1) === Math.abs(c2 - c1);
    if (!straight) return null;
    const len = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1)) + 1;
    const dr = Math.sign(r2 - r1);
    const dc = Math.sign(c2 - c1);
    const cells: [number, number][] = [];
    for (let i = 0; i < len; i++) cells.push([r1 + dr * i, c1 + dc * i]);
    return cells;
  }

  function clickCell(r: number, c: number) {
    if (solved) return;
    if (!first) {
      setFirst([r, c]);
      return;
    }
    const cells = lineCells(first, [r, c]);
    setFirst(null);
    if (!cells) return;
    const word = cells.map(([rr, cc]) => grid[rr][cc]).join("");
    const rev = word.split("").reverse().join("");
    // A word only counts once another machine has lit up its picture clue.
    const hit = targets.find((t) => (t === word || t === rev) && !found.includes(t) && !hidden.has(t));
    if (hit) {
      const nextFound = [...found, hit];
      setFound(nextFound);
      setFoundCells((prev) => {
        const s = new Set(prev);
        cells.forEach(([rr, cc]) => s.add(`${rr},${cc}`));
        return s;
      });
      if (nextFound.length === targets.length) onSolved();
    } else {
      onWrong();
      const s = new Set(cells.map(([rr, cc]) => `${rr},${cc}`));
      setBadCells(s);
      setTimeout(() => setBadCells(new Set()), 450);
    }
  }

  return (
    <div className="mt-4 text-center">
      <p className="font-fun text-lg font-700 text-slate-800">{puzzle.prompt}</p>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {targets.map((t) => {
          const got = found.includes(t);
          const isHidden = hidden.has(t);
          // Mask provider-gated words (until lit) AND secret words (always) as "?".
          const masked = isHidden || (secretSet.has(t) && !got);
          const emoji = wordHints?.get(t);
          // Masked → "?", revealed-with-a-picture → show only the emoji (never
          // the spelled-out word), otherwise (plain rooms) → show the word.
          const label = masked ? "❓ ? ?" : got ? "✅" : emoji ?? t;
          return (
            <span
              key={t}
              className={`rounded-full px-3 py-1 font-fun text-base font-700 ring-1 ${
                masked
                  ? "bg-slate-100 text-slate-400 ring-slate-200"
                  : got
                    ? "bg-mint/30 text-emerald-700 ring-emerald-300"
                    : "bg-amber-50 text-slate-600 ring-amber-100"
              }`}
            >
              {label}
            </span>
          );
        })}
      </div>

      <div className="mt-4 flex justify-center">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${grid.length + (withAxes ? 1 : 0)}, minmax(0, 1fr))` }}
        >
          {/* Top axis: column numbers */}
          {withAxes && (
            <>
              <span aria-hidden className="h-8 w-8 sm:h-9 sm:w-9" />
              {grid[0].map((_, c) => (
                <span
                  key={`col-${c}`}
                  className="flex h-8 w-8 items-center justify-center font-fun text-xs font-700 text-sky-600 sm:h-9 sm:w-9"
                >
                  {c + 1}
                </span>
              ))}
            </>
          )}

          {grid.map((row, r) => (
            <Fragment key={`row-${r}`}>
              {/* Left axis: row number */}
              {withAxes && (
                <span className="flex h-8 w-8 items-center justify-center font-fun text-xs font-700 text-sky-600 sm:h-9 sm:w-9">
                  {r + 1}
                </span>
              )}
              {row.map((ch, c) => {
                const key = `${r},${c}`;
                const isFound = foundCells.has(key);
                const isBad = badCells.has(key);
                const isFirst = first && first[0] === r && first[1] === c;
                const isCross = withAxes && allFound && key === crossKey;
                const cls = obscured
                  ? "bg-slate-200/70 text-slate-400 ring-slate-200 blur-[3px] select-none"
                  : isCross
                    ? "bg-sunny/80 text-slate-900 ring-amber-500 animate-pulse"
                    : isFound
                      ? "bg-mint/40 text-emerald-700 ring-emerald-300"
                      : isBad
                        ? "bg-coral/20 text-coral ring-coral/40"
                        : isFirst
                          ? "bg-sky/30 text-sky-700 ring-sky-400"
                          : "bg-amber-50 text-slate-700 ring-amber-100 hover:bg-amber-100";
                return (
                  <button
                    key={key}
                    onClick={() => clickCell(r, c)}
                    disabled={solved || obscured}
                    aria-hidden={obscured}
                    className={`flex h-8 w-8 items-center justify-center rounded-md font-mono text-sm font-700 ring-1 transition disabled:cursor-default sm:h-9 sm:w-9 ${cls}`}
                  >
                    {isCross ? "⭐" : ch}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <p className="mt-3 font-round text-xs text-slate-400">
        {obscured
          ? `🔒 The display is scrambled — solve the machines to light it up (${revealedCount}/${targets.length} clues lit).`
          : withAxes && allFound
            ? "⭐ The three words cross here! Column is 4 and Row is 5."
            : "Tap the first letter, then the last letter of a word."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Read-only recap shown when re-opening an already-solved station     */
/* ------------------------------------------------------------------ */

/** Static "here's the solution" view, so a player can review what they did. */
function PuzzleReview({
  puzzle,
  wordHints,
}: {
  puzzle: EscapeRoomPuzzle;
  wordHints?: Map<string, string>;
}) {
  const norm = (w: string) => w.toUpperCase().replace(/[^A-Z]/g, "");

  if (puzzle.kind === "mcq") {
    return (
      <div className="mt-3 text-center">
        {puzzle.emoji && <div className="text-4xl">{puzzle.emoji}</div>}
        <p className="mt-2 font-fun font-700 text-slate-800">{puzzle.prompt}</p>
        <div className="mt-3 rounded-2xl bg-mint/20 px-4 py-3 font-fun font-700 text-emerald-700 ring-1 ring-emerald-300">
          ✅ {puzzle.options[puzzle.answerIndex]}
        </div>
      </div>
    );
  }

  if (puzzle.kind === "code") {
    return (
      <div className="mt-3 text-center">
        {puzzle.emoji && <div className="text-4xl">{puzzle.emoji}</div>}
        <p className="mt-2 font-fun font-700 text-slate-800">{puzzle.prompt}</p>
        <div className="mt-3 flex flex-col items-center gap-2">
          <span className="rounded-xl bg-slate-900 px-4 py-1.5 font-mono text-lg font-700 tracking-widest text-mint">
            {puzzle.clue}
          </span>
          <span className="rounded-2xl bg-mint/20 px-4 py-1.5 font-fun font-700 text-emerald-700 ring-1 ring-emerald-300">
            ✅ {puzzle.answer}
          </span>
        </div>
      </div>
    );
  }

  if (puzzle.kind === "order") {
    return (
      <div className="mt-3 text-center">
        {puzzle.emoji && <div className="text-4xl">{puzzle.emoji}</div>}
        <p className="mt-2 font-fun font-700 text-slate-800">{puzzle.prompt}</p>
        <div className="mt-3 grid gap-2 text-left">
          {puzzle.items.map((it, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl bg-mint/15 px-4 py-2.5 font-fun font-600 text-slate-700 ring-1 ring-emerald-200"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white font-700 text-emerald-600">
                {i + 1}
              </span>
              {it}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (puzzle.kind === "cipher") {
    return (
      <div className="mt-3 text-center">
        {puzzle.emoji && <div className="text-4xl">{puzzle.emoji}</div>}
        <p className="mt-2 font-fun font-700 text-slate-800">{puzzle.prompt}</p>
        <div className="mt-3 inline-block rounded-2xl bg-mint/20 px-5 py-2 font-mono text-xl font-700 tracking-widest text-emerald-700 ring-1 ring-emerald-300">
          ✅ {puzzle.answer.toUpperCase()}
        </div>
      </div>
    );
  }

  if (puzzle.kind === "circuit") {
    return (
      <div className="mt-3 text-center">
        {puzzle.emoji && <div className="text-4xl">{puzzle.emoji}</div>}
        <p className="mt-2 font-fun font-700 text-slate-800">{puzzle.prompt}</p>
        <div className="mt-3 rounded-2xl bg-mint/20 px-4 py-3 font-fun font-700 text-emerald-700 ring-1 ring-emerald-300">
          ✅ ⚡ connected to 💡 — power restored!
        </div>
      </div>
    );
  }

  if (puzzle.kind === "sort") {
    return (
      <div className="mt-3 text-center">
        {puzzle.emoji && <div className="text-4xl">{puzzle.emoji}</div>}
        <p className="mt-2 font-fun font-700 text-slate-800">{puzzle.prompt}</p>
        <div className="mt-3 grid gap-1.5 text-left">
          {puzzle.items.map((it, i) => (
            <div
              key={i}
              className="rounded-xl bg-mint/15 px-3 py-1.5 font-fun text-sm font-600 text-emerald-700 ring-1 ring-emerald-200"
            >
              {puzzle.bins[it.bin].emoji} &ldquo;{it.text}&rdquo;
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (puzzle.kind === "maze" || puzzle.kind === "trailmaze" || puzzle.kind === "fair") {
    return (
      <div className="mt-3 text-center">
        {puzzle.emoji && <div className="text-4xl">{puzzle.emoji}</div>}
        <p className="mt-2 font-fun font-700 text-slate-800">{puzzle.prompt}</p>
        <div className="mt-3 rounded-2xl bg-mint/20 px-4 py-3 font-fun font-700 text-emerald-700 ring-1 ring-emerald-300">
          ✅ Core charged!
        </div>
      </div>
    );
  }

  if (puzzle.kind === "unscramble") {
    return (
      <div className="mt-3 text-center">
        {puzzle.emoji && <div className="text-4xl">{puzzle.emoji}</div>}
        <p className="mt-2 font-fun font-700 text-slate-800">{puzzle.prompt}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {puzzle.words.map((w) => (
            <span key={w} className="rounded-2xl bg-mint/20 px-4 py-1.5 font-fun text-lg font-700 tracking-widest text-emerald-700 ring-1 ring-emerald-300">
              {w.toUpperCase()}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (puzzle.kind === "crossword") {
    const gridCols = Math.max(...puzzle.rows.map((r) => r.offset + r.word.length));
    return (
      <div className="mt-3 text-center">
        <p className="font-fun font-700 text-slate-800">Crossword solved! 🎉</p>
        <div className="mt-3 flex justify-center overflow-x-auto">
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
            {puzzle.rows.map((row, r) => (
              <Fragment key={r}>
                {Array.from({ length: gridCols }).map((_, c) => {
                  const within = c >= row.offset && c < row.offset + row.word.length;
                  if (!within) return <span key={c} className="h-7 w-7 sm:h-8 sm:w-8" />;
                  const isSecret = c === puzzle.secretCol;
                  return (
                    <span
                      key={c}
                      className={`flex h-7 w-7 items-center justify-center rounded font-mono text-[11px] font-700 sm:h-8 sm:w-8 ${
                        isSecret ? "bg-sunny/80 text-slate-900 ring-2 ring-amber-500" : "bg-mint/20 text-emerald-700"
                      }`}
                    >
                      {row.word[c - row.offset]}
                    </span>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
        <p className="mt-2 font-round text-xs text-slate-500">
          ⭐ The gold column spells <span className="font-700 text-amber-600">{puzzle.secret.toUpperCase()}</span>.
        </p>
      </div>
    );
  }

  if (puzzle.kind === "symbol-lock") {
    return (
      <div className="mt-3 text-center">
        {puzzle.emoji && <div className="text-4xl">{puzzle.emoji}</div>}
        <p className="mt-2 font-fun font-700 text-slate-800">{puzzle.prompt}</p>
        <div className="mt-3 rounded-2xl bg-mint/20 px-4 py-3 font-fun text-lg font-700 tracking-[0.3em] text-emerald-700 ring-1 ring-emerald-300">
          🔓 {puzzle.word.toUpperCase()}
        </div>
      </div>
    );
  }

  // wordsearch — picture clues + words, plus the crossing grid for re-checking
  // the Column/Row at keypad time.
  const layout = puzzle.layout;
  const cross = puzzle.intersection;
  return (
    <div className="mt-3 text-center">
      <p className="font-fun font-700 text-slate-800">Found them all! 🎉</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {puzzle.words.map((w) => {
          const emoji = wordHints?.get(norm(w));
          return (
            <span
              key={w}
              className="rounded-full bg-mint/20 px-3 py-1 font-fun text-sm font-700 text-emerald-700 ring-1 ring-emerald-300"
            >
              {emoji ? `${emoji} ` : "✅ "}
              {norm(w)}
            </span>
          );
        })}
      </div>

      {layout && cross && (
        <>
          <div className="mt-3 flex justify-center">
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${layout.length + 1}, minmax(0, 1fr))` }}
            >
              <span aria-hidden className="h-7 w-7 sm:h-8 sm:w-8" />
              {layout[0].map((_, c) => (
                <span
                  key={`c${c}`}
                  className="flex h-7 w-7 items-center justify-center font-fun text-[10px] font-700 text-sky-600 sm:h-8 sm:w-8"
                >
                  {c + 1}
                </span>
              ))}
              {layout.map((row, r) => (
                <Fragment key={`r${r}`}>
                  <span className="flex h-7 w-7 items-center justify-center font-fun text-[10px] font-700 text-sky-600 sm:h-8 sm:w-8">
                    {r + 1}
                  </span>
                  {row.map((ch, c) => {
                    const isCross = r === cross[0] && c === cross[1];
                    return (
                      <span
                        key={`${r},${c}`}
                        className={`flex h-7 w-7 items-center justify-center rounded font-mono text-[11px] font-700 sm:h-8 sm:w-8 ${
                          isCross ? "bg-sunny/80 text-slate-900 ring-2 ring-amber-500" : "bg-amber-50 text-slate-400"
                        }`}
                      >
                        {isCross ? "⭐" : ch}
                      </span>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
          <p className="mt-2 font-round text-xs text-slate-500">
            ⭐ Read its Column and Row for the door.
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Exit keypad — type the code collected from the machines            */
/* ------------------------------------------------------------------ */

/**
 * The door's number lock. Each box is one part of the code (e.g. Column, Row),
 * labelled so the player knows what to read off the word search and type in.
 */
function ExitKeypad({
  slots,
  code,
  outro,
  onClose,
  onEscape,
}: {
  slots: { value: string }[];
  code: string;
  outro: string;
  onClose: () => void;
  onEscape: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(() => slots.map(() => ""));
  const [shake, setShake] = useState(false);
  const [ok, setOk] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function setDigit(i: number, raw: string) {
    const d = raw.replace(/[^0-9]/g, "").slice(-1);
    setDigits((arr) => {
      const next = [...arr];
      next[i] = d;
      return next;
    });
    if (d && i < slots.length - 1) refs.current[i + 1]?.focus();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (ok) return;
    if (digits.join("") === code) {
      setOk(true);
      window.setTimeout(onEscape, 800);
    } else {
      setShake(true);
      window.setTimeout(() => setShake(false), 450);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close keypad"
        onClick={() => !ok && onClose()}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative z-10 w-full max-w-md rounded-[2rem] bg-white p-7 text-center shadow-2xl ring-1 ring-amber-100">
        <div className="text-5xl">🔢</div>
        <h3 className="mt-2 font-fun text-2xl font-700 text-slate-900">Door Keypad</h3>

        {ok ? (
          <div className="mt-5 rounded-2xl bg-mint/15 p-5 ring-1 ring-mint/30">
            <div className="font-fun text-lg font-700 text-emerald-700">🎉 Click! The door unlocks!</div>
            <p className="mt-1 font-round text-sm text-slate-600">{outro}</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p className="mx-auto mt-1 max-w-xs font-round text-sm text-slate-500">
              Where the three words crossed on the display. ⭐
            </p>
            <div className="mt-5 flex justify-center gap-3">
              {slots.map((_s, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  value={digits[i]}
                  onChange={(e) => setDigit(i, e.target.value)}
                  inputMode="numeric"
                  className={`h-16 w-14 rounded-2xl border-2 text-center font-mono text-3xl font-700 text-slate-800 outline-none transition ${
                    shake ? "animate-pulse border-coral" : "border-amber-200 focus:border-coral"
                  }`}
                />
              ))}
            </div>
            {shake && (
              <p className="mt-3 font-fun text-sm font-600 text-coral">
                That code didn&apos;t work — go back to the display and check the crossing! 🔁
              </p>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-slate-100 px-5 py-2.5 font-fun font-600 text-slate-600 transition hover:bg-slate-200"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={digits.some((d) => !d)}
                className="rounded-full bg-coral px-7 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
              >
                Open door 🔓
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cipher door — decode the message the machines powered up           */
/* ------------------------------------------------------------------ */

/**
 * The Green Lab's exit. Three machines each power one piece of the decoder —
 * the key symbols, the key letters, and the coded message. Pieces that aren't
 * powered yet show as ❓; once all three are in, the player decodes the word and
 * types it to escape.
 */
function CipherExitKeypad({
  exit,
  solvedIds,
  outro,
  onClose,
  onEscape,
}: {
  exit: RoomCipherExit;
  solvedIds: string[];
  outro: string;
  onClose: () => void;
  onEscape: () => void;
}) {
  const symbolsOn = solvedIds.includes(exit.revealSymbols);
  const lettersOn = solvedIds.includes(exit.revealLetters);
  const codedOn = solvedIds.includes(exit.revealCoded);
  const ready = symbolsOn && lettersOn && codedOn;

  const [value, setValue] = useState("");
  const [shake, setShake] = useState(false);
  const [ok, setOk] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (ok || !ready) return;
    if (value.trim().toUpperCase() === exit.answer.trim().toUpperCase()) {
      setOk(true);
      window.setTimeout(onEscape, 800);
    } else {
      setShake(true);
      window.setTimeout(() => setShake(false), 450);
    }
  }

  const checklist = [
    { on: symbolsOn, label: "Key symbols" },
    { on: lettersOn, label: "Key letters" },
    { on: codedOn, label: "Secret message" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close decoder"
        onClick={() => !ok && onClose()}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-7 text-center shadow-2xl ring-1 ring-amber-100">
        <div className="text-5xl">🔣</div>
        <h3 className="mt-2 font-fun text-2xl font-700 text-slate-900">Door Decoder</h3>

        {ok ? (
          <div className="mt-5 rounded-2xl bg-mint/15 p-5 ring-1 ring-mint/30">
            <div className="font-fun text-lg font-700 text-emerald-700">🎉 Code accepted — the door swings open!</div>
            <p className="mt-1 font-round text-sm text-slate-600">{outro}</p>
          </div>
        ) : (
          <>
            {/* Which machines have powered which piece */}
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {checklist.map((c) => (
                <span
                  key={c.label}
                  className={`rounded-full px-3 py-1 font-fun text-xs font-700 ring-1 ${
                    c.on ? "bg-mint/20 text-emerald-700 ring-emerald-300" : "bg-slate-100 text-slate-400 ring-slate-200"
                  }`}
                >
                  {c.on ? "✅" : "🔒"} {c.label}
                </span>
              ))}
            </div>

            {/* Decoder key: symbol over letter (❓ until its machine is fixed) */}
            <div className="mt-4 rounded-2xl bg-slate-900 p-4 ring-2 ring-slate-700">
              <p className="font-fun text-xs font-700 uppercase tracking-wider text-slate-400">🔑 Decoder Key</p>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {exit.symbols.map((sym, i) => (
                  <div key={i} className="flex flex-col items-center rounded-lg bg-slate-800 py-1.5">
                    <span className="text-lg">{symbolsOn ? sym : "❓"}</span>
                    <span className="font-mono text-sm font-700 text-mint">{lettersOn ? exit.letters[i] : "❓"}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Coded message */}
            <p className="mt-4 font-fun text-sm font-600 text-slate-500">The door reads:</p>
            <div className="mt-2 flex justify-center gap-2">
              {exit.coded.map((sym, k) => (
                <span
                  key={k}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-2xl ring-2 ring-amber-200"
                >
                  {codedOn ? sym : "❓"}
                </span>
              ))}
            </div>

            <form onSubmit={submit} className="mt-4 flex justify-center gap-2">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value.toUpperCase())}
                disabled={!ready}
                placeholder={ready ? "Type the word" : "Power all 3 machines"}
                aria-label="Type the decoded word"
                className={`w-48 rounded-full border-2 px-5 py-2.5 text-center font-fun text-lg font-700 uppercase tracking-widest text-slate-800 outline-none transition disabled:bg-slate-50 disabled:text-slate-300 ${
                  shake ? "animate-pulse border-coral" : "border-amber-200 focus:border-coral"
                }`}
              />
              <button
                type="submit"
                disabled={!ready || !value.trim()}
                className="rounded-full bg-coral px-6 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
              >
                Decode 🔓
              </button>
            </form>
            {shake && (
              <p className="mt-3 font-fun text-sm font-600 text-coral">That&apos;s not it — check the key and try again! 🔁</p>
            )}
            <div className="mt-5">
              <button onClick={onClose} className="font-fun text-sm font-600 text-slate-400 hover:text-coral">
                ← Back to the lab
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Unscramble door — each core unlocks a scrambled word to fix         */
/* ------------------------------------------------------------------ */

/**
 * The hero-suit exit. Each core (station) reveals one scrambled word; until its
 * core is charged the word shows as 🔒. Unscramble all of them to power the
 * suit and escape.
 */
function UnscrambleExitKeypad({
  exit,
  solvedIds,
  outro,
  done: doneIdx,
  onWordSolved,
  onClose,
  onEscape,
}: {
  exit: RoomUnscrambleExit;
  solvedIds: string[];
  outro: string;
  done: number[];
  onWordSolved: (i: number) => void;
  onClose: () => void;
  onEscape: () => void;
}) {
  const [vals, setVals] = useState<string[]>(() => exit.words.map(() => ""));
  const done = exit.words.map((_, i) => doneIdx.includes(i));
  const allDone = done.every(Boolean);
  const [shake, setShake] = useState<number | null>(null);
  const [ok, setOk] = useState(false);

  // If every core was already unscrambled (e.g. solved, then closed before the
  // power-up animation finished), reopening the console completes the escape.
  useEffect(() => {
    if (allDone && !ok) {
      setOk(true);
      const t = window.setTimeout(onEscape, 800);
      return () => window.clearTimeout(t);
    }
  }, [allDone, ok, onEscape]);

  function check(i: number, e: React.FormEvent) {
    e.preventDefault();
    const w = exit.words[i];
    if (!solvedIds.includes(w.reveal) || done[i]) return;
    if (vals[i].trim().toUpperCase() === w.answer.trim().toUpperCase()) {
      onWordSolved(i);
      if (done.every((d, k) => d || k === i)) {
        setOk(true);
        window.setTimeout(onEscape, 800);
      }
    } else {
      setShake(i);
      window.setTimeout(() => setShake((s) => (s === i ? null : s)), 450);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close suit console"
        onClick={() => !ok && onClose()}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-7 text-center shadow-2xl ring-1 ring-amber-100">
        <div className="text-5xl">🦸</div>
        <h3 className="mt-2 font-fun text-2xl font-700 text-slate-900">Suit Power Core</h3>

        {ok ? (
          <div className="mt-5 rounded-2xl bg-mint/15 p-5 ring-1 ring-mint/30">
            <div className="font-fun text-lg font-700 text-emerald-700">🎉 Suit fully charged — power up!</div>
            <p className="mt-1 font-round text-sm text-slate-600">{outro}</p>
          </div>
        ) : (
          <>
            <p className="mx-auto mt-1 max-w-xs font-round text-sm text-slate-500">
              Charge a core to reveal its scrambled word, then unscramble all three.
            </p>
            <div className="mt-4 grid gap-3">
              {exit.words.map((w, i) => {
                const revealed = solvedIds.includes(w.reveal);
                return (
                  <div key={i} className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-100">
                    <div className="font-fun text-xs font-700 text-slate-500">
                      {w.emoji} {w.core}
                    </div>
                    {done[i] ? (
                      <div className="mt-1 font-fun text-lg font-700 tracking-widest text-emerald-700">✅ {w.answer}</div>
                    ) : revealed ? (
                      <>
                        <div className="mt-1 font-mono text-2xl font-700 tracking-[0.3em] text-grape">{w.scrambled}</div>
                        <form onSubmit={(e) => check(i, e)} className="mt-2 flex justify-center gap-2">
                          <input
                            value={vals[i]}
                            onChange={(e) =>
                              setVals((v) => v.map((x, k) => (k === i ? e.target.value.toUpperCase() : x)))
                            }
                            placeholder="Unscramble"
                            aria-label={`Unscramble ${w.core}`}
                            className={`w-36 rounded-full border-2 px-4 py-2 text-center font-fun text-base font-700 uppercase tracking-widest text-slate-800 outline-none transition ${
                              shake === i ? "animate-pulse border-coral" : "border-amber-200 focus:border-coral"
                            }`}
                          />
                          <button
                            type="submit"
                            disabled={!vals[i].trim()}
                            className="rounded-full bg-coral px-4 py-2 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
                          >
                            Fix
                          </button>
                        </form>
                      </>
                    ) : (
                      <div className="mt-1 font-fun text-lg font-700 text-slate-300">🔒 Core not charged yet</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-5">
              <button onClick={onClose} className="font-fun text-sm font-600 text-slate-400 hover:text-coral">
                ← Back to the lab
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
