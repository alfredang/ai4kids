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

/** Where the exit door pins inside its room. `pin` is the wall anchor for the
 *  door graphic (with `transform` seating it against that wall); `hotspot` is the
 *  spot just inside the room the player walks up to. Defaults to the bottom wall. */
function exitDoorAnchor(er: Rect, side: "top" | "bottom" | "left" | "right" = "bottom") {
  const c = centerOf(er);
  switch (side) {
    case "top":
      return { hotspot: { x: c.x, y: er.y + 22 }, pin: { x: c.x, y: er.y + 4 }, transform: "translate(-50%, 0)" };
    case "left":
      return { hotspot: { x: er.x + 22, y: c.y }, pin: { x: er.x + 4, y: c.y }, transform: "translate(0, -50%)" };
    case "right":
      return { hotspot: { x: er.x + er.w - 22, y: c.y }, pin: { x: er.x + er.w - 4, y: c.y }, transform: "translate(-100%, -50%)" };
    default:
      return { hotspot: { x: c.x, y: c.y + 22 }, pin: { x: c.x, y: er.y + er.h - 4 }, transform: "translate(-50%, -100%)" };
  }
}

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
      if (d.ceiling || d.flat || (d.w != null && d.h != null)) continue; // ceiling / flat — walk over/under
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
      const { hotspot } = exitDoorAnchor(er, layout.exitDoorSide);
      list.push({ key: "exit", kind: "exit", id: layout.exit, label: "Open the door", x: hotspot.x, y: hotspot.y, enabled: exitReady });
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
        {/* Floor rooms — gradient tile + optional texture + a per-plate variation
            grid (worn / polished / missing plates) for tiled floor kinds. */}
        {layout.cells.map((cell) => {
          const r = geo.floors[cell.id];
          const rect = { left: pct(r.x, W), top: pct(r.y, H), width: pct(r.w, W), height: pct(r.h, H) };
          const kind = cell.floorKind ?? room.floorKind;
          const tex = FLOOR_TEXTURE[kind];
          const grid = FLOOR_GRID[kind];
          const cols = grid ? grid.cols(r.w, r.h) : 0;
          const rows = grid ? grid.rows(r.w, r.h) : 0;
          return (
            <Fragment key={cell.id}>
              <div
                className={`absolute z-0 rounded-lg bg-gradient-to-br ${cell.floor ?? room.wall} opacity-90`}
                style={rect}
              />
              {tex && <div aria-hidden className="pointer-events-none absolute z-0 rounded-lg" style={{ ...rect, ...tex }} />}
              {grid && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute z-0 grid overflow-hidden rounded-lg"
                  style={{ ...rect, gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
                >
                  {Array.from({ length: rows * cols }).map((_, i) => (
                    <div key={i} style={grid.tile(seededRand(`${cell.id}:${Math.floor(i / cols)}:${i % cols}`))} />
                  ))}
                </div>
              )}
            </Fragment>
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
          // Ceiling fixtures (stretched runs, or point props flagged `ceiling`)
          // hang ABOVE the player (z-45 > player z-40) in the room you're in, and
          // drop below the fog (z-25) elsewhere so the fog-of-war still hides them.
          // Everything else is a floor prop under the player (z-10).
          const ceiling = d.ceiling || (d.w != null && d.h != null);
          const z = ceiling ? (d.room === curRoom ? "z-[45]" : "z-10") : "z-10";
          // Explicit w/h → a stretched run (e.g. a cable / bunting).
          if (d.w != null && d.h != null) {
            return (
              <svg
                key={`decor-${i}`}
                aria-hidden
                viewBox="0 0 40 40"
                preserveAspectRatio="none"
                className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 ${z}`}
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
              className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 ${z}`}
              style={{ left, top }}
            >
              <Prop
                art={d.art}
                className="h-12 w-12 sm:h-14 sm:w-14"
                style={{
                  transform: `scale(${d.flip ? -s : s}, ${s})`,
                  // Standing props cast a shadow; flat decals are painted on the
                  // floor, so no shadow (it would muddy thin shapes like the logo).
                  filter: d.flat ? undefined : "drop-shadow(0 2px 3px rgba(0,0,0,0.4))",
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
              className="absolute z-[55] -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900/70 px-2 py-0.5 font-fun text-[9px] font-700 text-white/90 sm:text-[11px]"
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
              className={`absolute z-20 h-8 w-8 -translate-x-1/2 -translate-y-1/2 outline-none transition focus-visible:outline-none sm:h-9 sm:w-9 ${ringed ? "scale-110" : ""}`}
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

        {/* Hero suit by the exit — chest sockets light as charged cores arrive. */}
        {carry?.mode === "charge" && suitPt && (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ left: pct(suitPt.x, W), top: pct(suitPt.y - 8, H) }}
          >
            <SuitModel
              cores={carryItems.map((it) => ({ color: CORE_COLOR[it.station ?? ""] ?? "#a3a3a3", lit: delivered.includes(it.id) }))}
              className="h-20 w-auto drop-shadow-lg sm:h-24"
            />
          </div>
        )}

        {/* Time Capsule in the history vault — treasures nest into its slots as
            they're placed (the loose delivered props are hidden below). */}
        {carry?.mode === "direct" && room.scene === "history" && suitPt && (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ left: pct(suitPt.x, W), top: pct(suitPt.y, H) }}
          >
            <TimeCapsuleModel
              slots={carryItems.map((it) => ({ emoji: it.emoji, filled: delivered.includes(it.id) }))}
              className="h-16 w-auto drop-shadow-lg sm:h-20"
            />
          </div>
        )}

        {/* World items — loose / charged / set-down / delivered (carried one is
            drawn on the character). */}
        {carryItems.map((it, i) => {
          if (carrying === it.id) return null;
          // Delivered charge cores live in the suit's sockets, and the history
          // vault's treasures nest in the Time Capsule — not loose on the floor.
          if (delivered.includes(it.id) && (carry?.mode === "charge" || (carry?.mode === "direct" && room.scene === "history"))) return null;
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
              className={`absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center outline-none transition focus-visible:outline-none ${isCore ? "h-6 w-6 sm:h-7 sm:w-7" : "h-8 w-8 sm:h-10 sm:w-10"} ${ringed ? "scale-110" : ""} ${pickable ? "" : "cursor-default"}`}
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
                  style={{ background: chargedCore ? CORE_GRADIENT[it.station ?? ""] ?? CORE_CHARGED_FALLBACK : CORE_DIM }}
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
              className={`absolute z-20 h-12 w-12 -translate-x-1/2 -translate-y-1/2 outline-none transition focus-visible:outline-none sm:h-14 sm:w-14 ${
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

        {/* Exit door — skinned to the room's scene where one is defined. */}
        {(() => {
          const er = geo.floors[layout.exit];
          if (!er) return null;
          const { pin, transform } = exitDoorAnchor(er, layout.exitDoorSide);
          const door = DOOR_ART[room.scene] ?? { open: "doorOpen", locked: "doorLocked" };
          return (
            <button
              onClick={() => exitReady && performAction(near?.kind === "exit" ? near : { key: "exit", kind: "exit", id: layout.exit, label: "", x: pin.x, y: pin.y, enabled: true })}
              className={`absolute z-20 h-12 w-10 outline-none transition focus-visible:outline-none sm:h-16 sm:w-12 ${exitReady ? "animate-pulse" : ""}`}
              style={{
                left: pct(pin.x, W),
                top: pct(pin.y, H),
                transform,
                filter: exitReady ? "drop-shadow(0 0 6px rgba(251,191,36,0.9))" : "drop-shadow(0 2px 2px rgba(0,0,0,0.35))",
              }}
              title={exitReady ? "Open the door" : "Locked — finish the room first"}
            >
              <Prop art={exitReady ? door.open : door.locked} className="h-full w-full" />
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
                  style={{ background: carriedReady ? CORE_GRADIENT[heldItem.station ?? ""] ?? CORE_CHARGED_FALLBACK : CORE_DIM }}
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

/** The Merlion vector (original viewBox 0 0 99.56 122.88) — a maned lion head
 *  spouting water over a scaled fish body. */
const MERLION_PATH =
  "M47.98,48.48c0.25-1.14,0.55-2.24,0.91-3.3c0.44-1.28,0.97-2.46,1.6-3.53l0.2-0.32c-1.76-0.32-3.12-1.05-4.03-1.98c-0.68-0.69-1.13-1.49-1.34-2.32c-0.22-0.86-0.18-1.75,0.13-2.61c0.52-1.45,1.81-2.73,3.89-3.39c1.17-0.38,2.39-0.44,3.61-0.51c2.08-0.12,4.15-0.23,4.71-2.54c0.05-0.2,0.04-0.37-0.01-0.52v-0.01c-0.08-0.24-0.29-0.48-0.57-0.69L57,26.73c-0.42-0.29-0.97-0.52-1.58-0.67c-1.14-0.28-2.45-0.27-3.56,0.09c-0.08,0.03-0.16,0.05-0.24,0.07c-0.94,0.18-1.78,0.41-2.52,0.6c-1.69,0.46-2.9,0.78-4.33,0.33c-1.92-0.62-3.69-2.53-4.49-4.76c-0.4-1.12-0.57-2.34-0.41-3.54l0.01-0.05c0.18-1.26,0.72-2.47,1.72-3.52c1.57-1.62,4.28-2.79,8.57-2.89c0.47-1,1.04-1.88,1.7-2.66c0.92-1.08,2-1.95,3.18-2.6c0.82-0.45,1.65-0.81,2.48-1.06c2.87-3.77,7.24-5.68,11.92-6.01C74.5-0.31,79.94,1.17,84.26,4.1c8.78,5.95,9.06,15.48,9.35,25.14c0.12,4.12,0.25,8.27,1.08,12.09c0.63,2.9,1.78,5.49,2.96,8.16c0.39,0.88,0.78,1.77,1.18,2.72c0.26,0.62,0.05,1.32-0.46,1.71c-0.76,0.64-2.17,1.63-3.89,2.55c0.37,1.75,0.85,3.49,1.52,5.25c0.79,2.07,1.83,4.13,3.24,6.18l0.08,0.1c0.44,0.67,0.25,1.58-0.42,2.02c-1.72,1.13-3.42,2.01-5.31,2.71c0.91,6.65,1.54,13.25,1.48,19.39c-0.07,6.6-0.96,12.67-3.21,17.7c-1.88,4.21-4.61,7.33-7.81,9.47c-3.51,2.34-7.59,3.49-11.76,3.58c-1.24,0.03-2.47-0.02-3.66-0.15c-6.08-0.63-11.66-3.14-15.76-7.06c-4.14-3.96-6.77-9.33-6.9-15.66c-0.02-1.01,0.02-2.03,0.13-3.06c0.21-2.02,0.71-4.06,1.2-6.11c0.37-1.52,0.74-3.05,0.99-4.55c0.8-4.91-0.04-10.64-1.78-16.11c-2.02-6.34-5.24-12.27-8.52-16.11c-0.45-0.53-0.46-1.29-0.06-1.82c1.27-1.81,2.97-3,4.84-3.6c1.45-0.46,2.99-0.57,4.5-0.32C47.49,48.37,47.74,48.42,47.98,48.48L47.98,48.48z M74.14,112.99c-0.11-0.79,0.45-1.53,1.24-1.64c0.8-0.11,1.53,0.45,1.64,1.24c0.25,1.77-0.5,2.89-1.63,3.5c-0.68,0.37-1.5,0.5-2.27,0.44c-0.66-0.05-1.31-0.25-1.85-0.57c-0.54,0.31-1.2,0.51-1.85,0.57c-0.77,0.06-1.58-0.07-2.27-0.44c-1.13-0.61-1.88-1.73-1.63-3.5c0.11-0.8,0.85-1.35,1.64-1.24c0.8,0.11,1.35,0.84,1.24,1.64c-0.04,0.32,0.02,0.48,0.13,0.54c0.17,0.09,0.41,0.12,0.66,0.1c0.22-0.02,0.43-0.07,0.58-0.15c-0.1-0.68,0.3-1.36,0.98-1.59c0.17-0.06,0.35-0.08,0.52-0.07c0.17-0.01,0.35,0.02,0.52,0.07c0.68,0.22,1.08,0.9,0.98,1.59c0.15,0.08,0.36,0.13,0.58,0.15c0.25,0.02,0.49-0.01,0.66-0.1C74.12,113.47,74.18,113.31,74.14,112.99L74.14,112.99z M51.48,82.13c0.35,0.04,0.7,0.08,1.04,0.13c-0.35-4.4-0.44-9.02-0.29-13.67c0.12-4.01,0.41-8.04,0.84-11.96c-0.69-1.85-1.83-3.24-3.17-4.17c-0.96-0.66-2.02-1.09-3.1-1.26c-1.07-0.17-2.16-0.1-3.17,0.22c-0.99,0.32-1.91,0.88-2.69,1.7c3.24,4.09,6.33,9.97,8.31,16.19C50.6,73.54,51.45,77.97,51.48,82.13L51.48,82.13z M55.49,82.87l0.1,0.03c0.7-4.3,1.62-8.68,2.78-12.27c0.99-3.07,2.19-5.6,3.62-7.1c0.05-0.93-0.12-1.77-0.43-2.51c-0.39-0.91-1.02-1.67-1.77-2.23c-0.75-0.56-1.63-0.92-2.49-1.04c-0.48-0.06-0.96-0.05-1.42,0.05c-0.38,3.59-0.63,7.24-0.74,10.87C54.98,73.51,55.08,78.32,55.49,82.87L55.49,82.87z M58.36,84.01l0.08,0.04c0.86-1.51,2.02-3.36,3.62-5.14c1.65-1.84,3.73-3.6,6.39-4.83c0.06-0.26,0.11-0.53,0.15-0.8c0.27-1.8-0.03-3.43-0.79-4.71c-0.4-0.67-0.93-1.26-1.58-1.73c-0.28-0.08-0.53-0.23-0.71-0.45c-0.38-0.2-0.79-0.38-1.23-0.51c-0.13-0.04-0.28-0.08-0.42-0.11c-1,1.17-1.92,3.22-2.73,5.74C59.98,75.11,59.06,79.61,58.36,84.01L58.36,84.01z M60.82,85.76l0.03,0.03c2.05-0.91,4.11-1.45,6.16-1.62c1.97-0.17,3.93,0,5.88,0.51c0.57-1.18,0.56-2.32,0.11-3.45c-0.58-1.44-1.85-2.9-3.56-4.39c-2.14,1.04-3.85,2.49-5.21,4.01C62.72,82.54,61.62,84.33,60.82,85.76L60.82,85.76z M62.81,88.12c0.33,0.5,0.64,1.03,0.94,1.6c0.37,0.71,0.09,1.59-0.63,1.96c-0.71,0.36-1.58,0.09-1.95-0.61c-0.55,0.33-0.95,0.72-1.2,1.13c-0.26,0.42-0.38,0.87-0.38,1.34c0,0.51,0.13,1.05,0.38,1.58c0.45,0.96,1.27,1.86,2.35,2.53c1.27,0.79,2.85,1.22,4.46,1.05c1.38-0.14,2.8-0.74,4.09-1.94c0.55-0.52,1.04-1.11,1.44-1.75c0.39-0.63,0.71-1.32,0.92-2.06c0.26-0.88,0.34-1.83,0.19-2.83c-0.12-0.8-0.4-1.64-0.86-2.52c-1.76-0.51-3.53-0.69-5.32-0.54C65.77,87.2,64.29,87.55,62.81,88.12L62.81,88.12z M59.56,88.65c-0.81-0.94-1.73-1.64-2.75-2.17c-1.53-0.79-3.35-1.21-5.46-1.44c-0.05,0.58-0.13,1.15-0.22,1.71c-0.26,1.59-0.65,3.18-1.03,4.77c-0.2,0.83-0.4,1.65-0.58,2.47c0.31-0.35,0.79-0.54,1.28-0.47c0.8,0.11,1.35,0.85,1.24,1.64c-0.04,0.32,0.02,0.48,0.13,0.54c0.17,0.09,0.41,0.12,0.66,0.1c0.22-0.02,0.43-0.07,0.58-0.15c-0.1-0.68,0.3-1.36,0.98-1.59c0.76-0.25,1.58,0.16,1.83,0.92c0.43,1.29-0.1,2.33-1.09,3.01c-0.58,0.4-1.33,0.65-2.08,0.71c-0.77,0.06-1.58-0.07-2.27-0.44c-0.86-0.46-1.5-1.23-1.65-2.36c-0.07,0.45-0.14,0.9-0.18,1.34c-0.1,0.93-0.13,1.84-0.11,2.71c0.12,5.49,2.41,10.16,6,13.6c3.64,3.48,8.61,5.71,14.05,6.27c1.1,0.11,2.2,0.16,3.31,0.14c3.63-0.08,7.17-1.07,10.2-3.09c2.77-1.85,5.13-4.56,6.77-8.24c2.07-4.63,2.89-10.31,2.96-16.54c0.06-5.82-0.53-12.13-1.39-18.51c-2.93,0.72-6.42,1.11-11.08,1.29c-0.7,0.03-1.34-0.45-1.48-1.16c-1.15-5.59-1.83-11.79-2.08-17.86c-1,0.16-2.07,0.27-3.23,0.3c-1.43,0.03-2.98-0.08-4.71-0.42c-0.33,3.04-0.4,6.04-0.19,8.8c0.94,0.7,1.72,1.56,2.31,2.55c1.11,1.86,1.55,4.15,1.18,6.63c-0.04,0.29-0.1,0.6-0.17,0.91c2.06,1.78,3.61,3.61,4.38,5.51c0.85,2.09,0.8,4.19-0.45,6.32c0.55,1.1,0.89,2.18,1.05,3.23c0.23,1.45,0.11,2.83-0.27,4.09c-0.29,0.98-0.71,1.91-1.24,2.76c-0.54,0.88-1.2,1.67-1.93,2.36c-1.79,1.67-3.8,2.5-5.78,2.7c-2.27,0.23-4.49-0.37-6.28-1.47c-1.56-0.96-2.77-2.3-3.45-3.76c-0.43-0.91-0.66-1.87-0.66-2.82c0-1,0.26-1.98,0.81-2.87C57.98,89.92,58.65,89.22,59.56,88.65L59.56,88.65z M77.18,102.75c0.11-0.79,0.84-1.35,1.64-1.24s1.35,0.84,1.24,1.64c-0.04,0.32,0.02,0.48,0.13,0.54c0.17,0.09,0.41,0.12,0.66,0.1c0.23-0.02,0.43-0.07,0.58-0.15c-0.1-0.68,0.3-1.36,0.98-1.59c0.76-0.25,1.58,0.16,1.83,0.92c0.43,1.29-0.1,2.33-1.09,3.01c-0.58,0.4-1.33,0.65-2.08,0.71c-0.77,0.06-1.58-0.07-2.27-0.44C77.69,105.64,76.93,104.52,77.18,102.75L77.18,102.75z M55.09,103.61c0.11-0.8,0.84-1.35,1.64-1.24c0.79,0.11,1.35,0.84,1.24,1.64c-0.04,0.32,0.02,0.48,0.13,0.54c0.17,0.09,0.41,0.12,0.66,0.1c0.22-0.02,0.43-0.07,0.58-0.15c-0.1-0.68,0.3-1.36,0.98-1.59c0.76-0.25,1.58,0.16,1.83,0.92c0.43,1.29-0.1,2.33-1.09,3.01c-0.58,0.4-1.33,0.65-2.08,0.71c-0.77,0.06-1.58-0.07-2.26-0.44C55.6,106.5,54.84,105.38,55.09,103.61L55.09,103.61z M68.4,103.49c0.11-0.8,0.84-1.35,1.64-1.24c0.8,0.11,1.35,0.84,1.24,1.64c-0.04,0.32,0.02,0.48,0.13,0.54c0.17,0.09,0.41,0.12,0.66,0.1c0.23-0.02,0.43-0.07,0.58-0.15c-0.1-0.68,0.3-1.36,0.98-1.59c0.76-0.25,1.58,0.16,1.83,0.92c0.43,1.29-0.1,2.33-1.09,3.01c-0.58,0.4-1.33,0.65-2.08,0.71c-0.77,0.06-1.58-0.07-2.27-0.44C68.9,106.38,68.15,105.26,68.4,103.49L68.4,103.49z M85.98,93.76c-0.11-0.8,0.45-1.53,1.24-1.64c0.8-0.11,1.53,0.45,1.64,1.24c0.25,1.77-0.5,2.89-1.63,3.5c-0.68,0.37-1.5,0.5-2.26,0.44c-0.66-0.05-1.31-0.25-1.85-0.57c-0.54,0.31-1.2,0.51-1.85,0.57c-0.77,0.06-1.58-0.07-2.27-0.44c-1.13-0.61-1.88-1.73-1.63-3.5c0.11-0.8,0.84-1.35,1.64-1.24c0.8,0.11,1.35,0.84,1.24,1.64c-0.04,0.32,0.02,0.48,0.13,0.54c0.17,0.09,0.41,0.12,0.66,0.1c0.23-0.02,0.43-0.07,0.58-0.15c-0.1-0.68,0.3-1.36,0.98-1.59c0.17-0.06,0.35-0.08,0.52-0.07c0.17-0.01,0.35,0.02,0.52,0.07c0.68,0.22,1.08,0.9,0.98,1.59c0.15,0.08,0.36,0.13,0.58,0.15c0.25,0.02,0.49-0.01,0.66-0.1C85.96,94.24,86.03,94.08,85.98,93.76L85.98,93.76z M81.8,87.54c-0.32-0.74,0.02-1.59,0.75-1.91c0.74-0.32,1.59,0.02,1.91,0.75c0.06,0.15,0.21,0.25,0.37,0.3l0,0c0.19,0.06,0.41,0.07,0.64,0.04c0.2-0.03,0.37-0.09,0.49-0.18c0.05-0.04,0.09-0.09,0.09-0.14c0.06-0.8,0.76-1.4,1.56-1.34s1.4,0.76,1.34,1.56c-0.07,0.95-0.54,1.7-1.22,2.22c-0.53,0.41-1.18,0.67-1.85,0.77c-0.65,0.1-1.34,0.04-1.98-0.17C83.02,89.13,82.23,88.51,81.8,87.54L81.8,87.54z M79.72,79.54c0.11-0.8,0.84-1.35,1.64-1.24c0.79,0.11,1.35,0.84,1.24,1.64c-0.04,0.32,0.02,0.48,0.13,0.54c0.17,0.09,0.41,0.12,0.66,0.1c0.23-0.02,0.43-0.07,0.58-0.15c-0.1-0.68,0.3-1.36,0.98-1.59c0.76-0.25,1.58,0.16,1.83,0.92c0.43,1.29-0.1,2.33-1.09,3.01c-0.58,0.4-1.33,0.65-2.08,0.71c-0.77,0.06-1.58-0.07-2.26-0.44C80.22,82.44,79.47,81.31,79.72,79.54L79.72,79.54z M41.27,34.62c0.75-0.27,1.59,0.12,1.86,0.88s-0.12,1.59-0.88,1.86c-9.46,3.41-15.68,8.58-19.83,14.53c-4.17,5.97-6.28,12.76-7.5,19.34c-0.14,0.79-0.9,1.31-1.69,1.17c-0.79-0.14-1.31-0.9-1.17-1.69c1.29-6.92,3.53-14.1,7.98-20.48C24.51,43.82,31.17,38.26,41.27,34.62L41.27,34.62z M39.76,27.42c0.78-0.19,1.57,0.29,1.76,1.07c0.19,0.78-0.29,1.57-1.07,1.76c-9.27,2.3-16.9,6.13-23.09,11.27C11.17,46.66,6.38,53.14,2.77,60.75c-0.34,0.73-1.21,1.04-1.94,0.69s-1.04-1.21-0.69-1.94c3.78-7.98,8.82-14.8,15.36-20.23C22.04,33.86,30.05,29.83,39.76,27.42L39.76,27.42z M58.1,11.96c1.56-0.3,4.82,0.28,5.16,2.02c0.15,0.78-1.07,0.88-2.41,0.83l0,0.05c0,0.93-0.75,1.68-1.68,1.68c-0.93,0-1.68-0.75-1.68-1.68c0-0.07,0-0.14,0.01-0.21c-0.54-0.11-0.89-0.32-1.06-0.61C55.68,12.79,57.11,12.15,58.1,11.96L58.1,11.96z M53.69,51.72c0.01-0.04,0.01-0.09,0.02-0.13c0.32-1.68,0.78-3.28,1.41-4.8c1.26-3.04,3.2-5.72,6.02-7.94c0.63-0.5,1.55-0.39,2.04,0.24c0.5,0.63,0.39,1.55-0.25,2.04c-2.4,1.89-4.05,4.18-5.13,6.77c-0.55,1.33-0.96,2.74-1.24,4.22c-0.13,0.89-0.25,1.79-0.36,2.69c0.48-0.03,0.96-0.02,1.45,0.05c1.37,0.18,2.71,0.73,3.86,1.58c1.15,0.86,2.12,2.02,2.72,3.43c0.41,0.95,0.65,2.02,0.67,3.16l0.1,0.03c-0.14-3.66,0.16-7.62,0.82-11.47c0.82-4.76,2.2-9.38,4-13.11c0.35-0.72,1.22-1.03,1.94-0.68c0.72,0.35,1.03,1.22,0.68,1.94c-1.69,3.48-2.98,7.84-3.75,12.34c-0.04,0.25-0.08,0.5-0.12,0.75c1.58,0.32,2.99,0.43,4.27,0.4c1.12-0.02,2.18-0.15,3.2-0.33c-0.02-0.89-0.03-1.78-0.03-2.66c0-8.21,0.79-15.74,2.24-20.6c0.23-0.77,1.04-1.21,1.81-0.98s1.21,1.04,0.98,1.81c-1.38,4.61-2.13,11.84-2.13,19.77c0,1.23,0.02,2.47,0.05,3.72c0.01,0.08,0.01,0.15,0.01,0.22c0.18,5.96,0.78,12.12,1.84,17.72c3.9-0.2,6.89-0.56,9.4-1.2c2.19-0.55,4.04-1.32,5.84-2.37c-1.17-1.87-2.07-3.73-2.78-5.59c-0.64-1.67-1.12-3.35-1.5-5.03c-1.77,0.69-3.69,1.18-5.52,1.16c-0.71-0.01-1.3-0.53-1.42-1.21l0,0c-0.68-3.98-1.11-7.94-1.29-11.88c-0.18-3.94-0.12-7.82,0.18-11.66c0.06-0.8,0.76-1.4,1.56-1.34c0.8,0.06,1.4,0.76,1.34,1.56c-0.29,3.75-0.35,7.53-0.18,11.32c0.15,3.37,0.5,6.78,1.04,10.22c1.19-0.16,2.43-0.55,3.61-1.04c1.86-0.77,3.52-1.78,4.6-2.56c-0.24-0.55-0.48-1.1-0.72-1.65c-1.24-2.81-2.45-5.53-3.14-8.72c-0.88-4.04-1.01-8.34-1.14-12.62c-0.26-8.91-0.53-17.7-8.07-22.82c-0.41-0.27-0.82-0.54-1.25-0.78c0.4,0.42,0.78,0.87,1.13,1.35c3.13,4.13,4.72,10.05,4.09,16.61c-0.06,0.65-0.64,1.13-1.3,1.07c-0.65-0.06-1.13-0.64-1.07-1.3c0.57-5.96-0.84-11.29-3.62-14.96c-1.07-1.42-2.35-2.58-3.8-3.43c-1.44-0.84-3.04-1.38-4.79-1.54c-0.87-0.08-1.77-0.07-2.7,0.03c6.45,1.58,8.76,6.37,9.1,11.83c0.33,5.33-1.28,11.28-2.59,15.22c-0.21,0.62-0.88,0.96-1.5,0.75c-0.62-0.21-0.96-0.88-0.75-1.5c1.25-3.75,2.78-9.38,2.47-14.33c-0.29-4.63-2.27-8.67-7.9-9.79c-1.25-0.25-2.76-0.3-4.29,0.01c1.07,0.22,2.08,0.56,3.01,1L67,6.8c0.29,0.14,0.57,0.3,0.86,0.46c3.23,1.91,4.74,4.84,5.07,8.07c0.31,3.02-0.46,6.28-1.83,9.13l-0.05,0.12c-0.24,0.49-0.5,0.97-0.78,1.45c-1.03,1.74-2.31,3.37-3.72,4.87c-1.39,1.49-2.9,2.84-4.39,4.04c-0.91,0.73-1.8,1.41-2.66,2.07c-1.8,1.37-3.48,2.66-4.78,3.98l-0.08,0.08c-0.66,0.67-1.21,1.36-1.63,2.07c-0.54,0.91-0.99,1.92-1.36,2.99c-0.36,1.05-0.66,2.21-0.91,3.43c0.28,0.16,0.55,0.33,0.82,0.51c0.76,0.52,1.46,1.15,2.1,1.89L53.69,51.72L53.69,51.72L53.69,51.72z M56.57,52.13L56.57,52.13L56.57,52.13L56.57,52.13z M85.25,26.9c0.9,0,1.62,0.73,1.62,1.62c0,0.9-0.73,1.62-1.62,1.62c-0.9,0-1.62-0.73-1.62-1.62C83.63,27.63,84.35,26.9,85.25,26.9L85.25,26.9z M66.17,35.71c0.9,0,1.63,0.73,1.63,1.62s-0.73,1.62-1.63,1.62c-0.9,0-1.62-0.73-1.62-1.62S65.28,35.71,66.17,35.71L66.17,35.71z M53,38.58c1.37-1.32,3-2.57,4.72-3.89c0.86-0.65,1.74-1.33,2.6-2.02c1.42-1.15,2.83-2.4,4.1-3.76c1.25-1.34,2.4-2.8,3.33-4.37c0.23-0.39,0.46-0.81,0.67-1.24l0.06-0.11c1.15-2.4,1.8-5.11,1.55-7.58c-0.24-2.34-1.33-4.47-3.66-5.84c-0.2-0.12-0.41-0.23-0.65-0.35l-0.1-0.06c-1.33-0.63-2.91-1.01-4.58-0.96c-1.49,0.04-3.06,0.42-4.58,1.27c-0.88,0.49-1.68,1.13-2.37,1.94c-0.65,0.77-1.2,1.68-1.6,2.74c-0.23,0.61-0.83,0.98-1.46,0.94c-3.9-0.04-6.17,0.8-7.34,2.01c-0.55,0.57-0.84,1.23-0.94,1.91l-0.01,0.04c-0.09,0.71,0.02,1.46,0.27,2.16c0.51,1.43,1.55,2.62,2.63,2.97c0.6,0.19,1.47-0.04,2.69-0.37c0.74-0.2,1.59-0.43,2.65-0.63c1.62-0.52,3.49-0.53,5.11-0.14c0.96,0.23,1.85,0.61,2.57,1.11l0.09,0.07c0.77,0.56,1.35,1.28,1.63,2.13c0.22,0.66,0.26,1.37,0.08,2.13c-1.07,4.41-4.21,4.58-7.38,4.76c-1.04,0.06-2.07,0.11-2.88,0.37c-1.14,0.37-1.81,0.96-2.04,1.61c-0.11,0.29-0.12,0.61-0.04,0.92c0.09,0.34,0.28,0.67,0.58,0.98C49.5,38.1,50.93,38.65,53,38.58L53,38.58z";

/** The Merlion scaled into the 40×40 prop box. `base:"plinth"` sets it on a stone
 *  pedestal (the Lion City decor + station); the carried treasure omits the base. */
function MerlionFigure({ fill, base }: { fill: string; base?: "plinth" }) {
  // The figure fills the full box height with its base at the bottom-right, so the
  // pedestal version shrinks + lifts the Merlion to seat it on a wide plinth; the
  // carried treasure keeps the full-size figure (no base). A white silhouette image
  // sits behind the (line-art) path so the body reads white with a coloured outline.
  return base === "plinth" ? (
    <>
      <rect x="6" y="34" width="28" height="4" rx="1" fill="#b3aa99" stroke="#7d7565" strokeWidth="0.8" />
      <rect x="8" y="31.5" width="24" height="2.8" rx="0.5" fill="#cdc5b7" />
      <image href="/escape/merlion-body.png" x="6" y="1.6" width="24.9" height="30.7" />
      <g transform="translate(6 1.6) scale(0.25)">
        <path fill={fill} d={MERLION_PATH} />
      </g>
    </>
  ) : (
    <>
      <image href="/escape/merlion-body.png" x="3.8" y="0" width="32.4" height="40" />
      <g transform="translate(3.8 0) scale(0.3255)">
        <path fill={fill} d={MERLION_PATH} />
      </g>
    </>
  );
}

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
  // Merlion statue — a stone Merlion on a plinth, spouting water (the Lion City
  // Room's station). Same figure as the carried Merlion, in stone.
  statue: (
    <g transform="scale(1.2)">
      <MerlionFigure fill="#9a8f7d" base="plinth" />
    </g>
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
      {/* durian — khaki oval husk under long pyramid spikes, with a short stem */}
      <rect x="22.7" y="8.5" width="2.6" height="4" rx="1" fill="#6b4f2a" />
      {Array.from({ length: 15 }).map((_, i) => {
        const a = (i / 15) * Math.PI * 2 - Math.PI / 2;
        const bx = 24 + Math.cos(a) * 8.2;
        const by = 22 + Math.sin(a) * 9.0;
        const tx = 24 + Math.cos(a) * 13.2;
        const ty = 22 + Math.sin(a) * 14.4;
        const px = -Math.sin(a) * 2.1;
        const py = Math.cos(a) * 2.1;
        return <polygon key={i} points={`${bx + px},${by + py} ${bx - px},${by - py} ${tx},${ty}`} fill="#7c8a3e" />;
      })}
      <ellipse cx="24" cy="22" rx="9" ry="9.8" fill="#94a350" stroke="#5f6b2c" strokeWidth="1.1" />
      {[[20, 18], [28, 18.5], [24, 24], [19, 23], [29, 23], [24, 15], [21.5, 20.5], [26.5, 20.5]].map(([x, y], i) => (
        <path key={`f${i}`} d={`M${x - 2} ${y + 2} L${x} ${y - 2.4} L${x + 2} ${y + 2}`} fill="#7c8a3e" stroke="#5f6b2c" strokeWidth="0.7" strokeLinejoin="round" />
      ))}
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
  // Singapore flag (real artwork, viewBox 55.32×38.52) on a pole with a gold
  // finial — red over white, a crescent + five stars.
  flag: (
    <>
      <rect x="6.4" y="3.5" width="1.7" height="33" rx="0.85" fill="#8a8175" />
      <rect x="6.4" y="3.5" width="0.7" height="33" rx="0.35" fill="#a8a095" />
      <circle cx="7.25" cy="3" r="1.7" fill="#facc15" stroke="#ca8a04" strokeWidth="0.4" />
      <g transform="translate(7.25 4) scale(0.5)">
        <path fill="#ED2939" d="M0.06,19.26h55.2V3.09c0-1.66-1.35-3.02-3.01-3.03H3.07C1.41,0.07,0.06,1.43,0.06,3.09V19.26z" />
        <path fill="#FFFFFF" d="M3.07,38.46h49.17c1.66-0.01,3.01-1.37,3.01-3.03V19.26H0.06v16.17C0.06,37.09,1.41,38.45,3.07,38.46z" />
        <path fill="#FFFFFF" d="M18.62,9.66c0,3.99-3.23,7.22-7.22,7.22c-3.99,0-7.22-3.23-7.22-7.22c0-3.99,3.23-7.22,7.22-7.22C15.38,2.44,18.62,5.67,18.62,9.66z" />
        <path fill="#ED2939" d="M20.88,9.66c0,3.77-3.06,6.82-6.82,6.82c-3.77,0-6.82-3.06-6.82-6.82c0-3.77,3.06-6.82,6.82-6.82C17.83,2.84,20.88,5.89,20.88,9.66z" />
        <polygon fill="#FFFFFF" points="12.29,9.83 11.31,9.08 10.33,9.83 10.71,8.62 9.72,7.87 10.94,7.88 11.31,6.66 11.68,7.88 12.89,7.87 11.91,8.62" />
        <polygon fill="#FFFFFF" points="19.98,9.83 19,9.08 18.02,9.83 18.4,8.62 17.42,7.87 18.63,7.88 19,6.66 19.38,7.88 20.59,7.87 19.61,8.62" />
        <polygon fill="#FFFFFF" points="16.14,6.98 15.16,6.23 14.18,6.98 14.56,5.77 13.57,5.02 14.79,5.02 15.16,3.81 15.53,5.02 16.75,5.02 15.76,5.76" />
        <polygon fill="#FFFFFF" points="13.73,14.4 12.75,13.65 11.77,14.4 12.15,13.19 11.16,12.44 12.38,12.45 12.75,11.23 13.12,12.45 14.33,12.44 13.35,13.19" />
        <polygon fill="#FFFFFF" points="18.54,14.4 17.56,13.65 16.58,14.4 16.96,13.19 15.98,12.44 17.19,12.45 17.56,11.23 17.94,12.45 19.15,12.44 18.17,13.19" />
        <path fill="none" stroke="#94a3b8" strokeWidth="0.5" d="M3.09,0.06h49.13c1.67,0,3.03,1.36,3.03,3.03v32.33c0,1.67-1.36,3.03-3.03,3.03H3.09c-1.67,0-3.03-1.37-3.03-3.03V3.09C0.06,1.42,1.42,0.06,3.09,0.06z" />
      </g>
    </>
  ),
  // The Merlion — the national treasure carried to the Time Capsule.
  merlion: <MerlionFigure fill="#5f7284" />,
  // Singapore lion-head symbol — the real artwork, rendered as a painted floor
  // emblem (flat decal) for the Lion City Room.
  lionLogo: <image href="/escape/sg-lion.png" x="4" y="2" width="32" height="36" opacity="0.55" preserveAspectRatio="xMidYMid meet" />,
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
  // Festival carnival gate — striped posts, an arch of pennants, and closed/open gates.
  festivalGateLocked: (
    <>
      <rect x="8" y="14" width="5" height="23" rx="1" fill="#dc2626" />
      <rect x="27" y="14" width="5" height="23" rx="1" fill="#dc2626" />
      {[16, 20, 24, 28, 32].map((y, i) => (
        <g key={i}>
          <rect x="8" y={y} width="5" height="1.8" fill="#fff" opacity="0.85" />
          <rect x="27" y={y} width="5" height="1.8" fill="#fff" opacity="0.85" />
        </g>
      ))}
      <path d="M10.5 14 Q20 4 29.5 14" fill="none" stroke="#facc15" strokeWidth="2.5" />
      {[12, 16, 20, 24, 28].map((x, i) => {
        const y = 14 - Math.sin(((x - 10.5) / 19) * Math.PI) * 8.5;
        return <polygon key={`p${i}`} points={`${x - 1.5},${y} ${x + 1.5},${y} ${x},${y + 3.2}`} fill={["#fb7185", "#a78bfa", "#34d399", "#38bdf8", "#f472b6"][i]} />;
      })}
      <rect x="13" y="16" width="14" height="21" rx="1" fill="#b45309" stroke="#7c2d12" strokeWidth="1" />
      <line x1="20" y1="16" x2="20" y2="37" stroke="#7c2d12" strokeWidth="1" />
      <rect x="17" y="24.5" width="6" height="5" rx="1" fill="#fbbf24" />
      <path d="M18 24.5v-1.4a2 2 0 0 1 4 0v1.4" fill="none" stroke="#fbbf24" strokeWidth="1.2" />
      <circle cx="20" cy="27" r="0.9" fill="#7c2d12" />
    </>
  ),
  festivalGateOpen: (
    <>
      <rect x="8" y="14" width="5" height="23" rx="1" fill="#dc2626" />
      <rect x="27" y="14" width="5" height="23" rx="1" fill="#dc2626" />
      {[16, 20, 24, 28, 32].map((y, i) => (
        <g key={i}>
          <rect x="8" y={y} width="5" height="1.8" fill="#fff" opacity="0.85" />
          <rect x="27" y={y} width="5" height="1.8" fill="#fff" opacity="0.85" />
        </g>
      ))}
      <path d="M10.5 14 Q20 4 29.5 14" fill="none" stroke="#facc15" strokeWidth="2.5" />
      {[12, 16, 20, 24, 28].map((x, i) => {
        const y = 14 - Math.sin(((x - 10.5) / 19) * Math.PI) * 8.5;
        return <polygon key={`p${i}`} points={`${x - 1.5},${y} ${x + 1.5},${y} ${x},${y + 3.2}`} fill={["#fb7185", "#a78bfa", "#34d399", "#38bdf8", "#f472b6"][i]} />;
      })}
      <rect x="13" y="16" width="14" height="21" rx="1" fill="#fde68a" />
      <rect x="14.5" y="17.5" width="11" height="18" rx="0.8" fill="#fcd34d" opacity="0.6" />
      <rect x="13" y="16" width="2.4" height="21" rx="0.8" fill="#92400e" />
      <rect x="24.6" y="16" width="2.4" height="21" rx="0.8" fill="#92400e" />
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
  // --- recycling-plant decor ---
  // A three-bin recycling station (green / blue / amber) with white loop arrows.
  recycleBins: (
    <>
      {[
        { x: 6, fill: "#16a34a", lid: "#22c55e", edge: "#15803d" },
        { x: 16, fill: "#2563eb", lid: "#3b82f6", edge: "#1d4ed8" },
        { x: 26, fill: "#f59e0b", lid: "#fbbf24", edge: "#d97706" },
      ].map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={16} width={8} height={19} rx={1.5} fill={b.fill} stroke={b.edge} strokeWidth={1} />
          <rect x={b.x - 0.6} y={13.4} width={9.2} height={3.2} rx={1} fill={b.lid} stroke={b.edge} strokeWidth={0.8} />
          <rect x={b.x + 2.5} y={12} width={3} height={2} rx={0.6} fill={b.edge} />
          {[0, 1, 2].map((j) => (
            <polygon key={j} points={`${b.x + 4},22 ${b.x + 5.4},24.6 ${b.x + 2.6},24.6`} fill="#fff" opacity="0.9" transform={`rotate(${j * 120} ${b.x + 4} 24.6)`} />
          ))}
        </g>
      ))}
    </>
  ),
  // A conveyor belt discharging into a blue magnetic-separator box (a drum at the
  // transfer point, output chutes, red stop button) — the sorting line's front end.
  conveyor: (
    <>
      {/* separator unit */}
      <rect x="21" y="11" width="15" height="19" rx="1.5" fill="#2563eb" stroke="#1e3a8a" strokeWidth="1.4" />
      <rect x="23" y="13" width="11" height="5" rx="1" fill="#1e40af" />
      <rect x="24" y="20.5" width="6" height="4" rx="0.6" fill="#1e3a8a" />
      <circle cx="32.5" cy="23.5" r="1.3" fill="#ef4444" />
      <rect x="24" y="30" width="2" height="6" fill="#1e3a8a" />
      <rect x="32" y="30" width="2" height="6" fill="#1e3a8a" />
      {/* magnetic drum at the belt-to-separator transfer */}
      <circle cx="21" cy="23" r="3.6" fill="#94a3b8" stroke="#334155" strokeWidth="1.1" />
      <circle cx="21" cy="23" r="1.3" fill="#475569" />
      {/* belt feeding in from the left */}
      <rect x="3" y="20.2" width="18" height="5.4" rx="2.7" fill="#475569" stroke="#334155" strokeWidth="1.1" />
      <circle cx="6" cy="22.9" r="2.4" fill="#94a3b8" stroke="#334155" strokeWidth="0.9" />
      <circle cx="6" cy="22.9" r="0.8" fill="#475569" />
      {/* recyclables riding toward the separator */}
      <rect x="8.5" y="16" width="3.2" height="4.6" rx="1.4" fill="#7dd3fc" stroke="#0891b2" strokeWidth="0.6" />
      <circle cx="15" cy="18.1" r="1.9" fill="#fde68a" stroke="#d97706" strokeWidth="0.6" />
      {/* belt legs */}
      <rect x="5" y="25.6" width="2" height="8.4" fill="#334155" />
      <rect x="16" y="25.6" width="2" height="8.4" fill="#334155" />
    </>
  ),
  // A baler / compactor machine — hopper on top, hazard band, a fresh bale in the
  // output slot.
  compactor: (
    <>
      <rect x="8" y="9" width="24" height="25" rx="2" fill="#3f6212" stroke="#1a2e05" strokeWidth="1.4" />
      <rect x="12" y="7" width="16" height="4" rx="1" fill="#1a2e05" />
      <rect x="10.5" y="13" width="6" height="8" rx="1" fill="#1a2e05" />
      <circle cx="13.5" cy="15.5" r="1" fill="#f87171" />
      <circle cx="13.5" cy="18.5" r="1" fill="#4ade80" />
      <rect x="8" y="23.4" width="24" height="2.2" fill="#facc15" />
      <rect x="19" y="26.5" width="11" height="7" rx="0.8" fill="#1a2e05" />
      <rect x="20.2" y="27.6" width="8.6" height="5" rx="0.5" fill="#a3e635" stroke="#4d7c0f" strokeWidth="0.7" />
      <line x1="23" y1="27.6" x2="23" y2="32.6" stroke="#4d7c0f" strokeWidth="0.6" />
      <line x1="26" y1="27.6" x2="26" y2="32.6" stroke="#4d7c0f" strokeWidth="0.6" />
    </>
  ),
  // Overhead pipe run (ceiling, stretched via w/h) — a fat grey pipe + thin teal
  // line hung from two straps. Non-scaling strokes stay crisp when stretched wide.
  pipeRun: (
    <>
      <rect x="10" y="5" width="1.6" height="8" fill="#334155" />
      <rect x="28.4" y="5" width="1.6" height="8" fill="#334155" />
      <line x1="0" y1="13" x2="40" y2="13" stroke="#475569" strokeWidth="5" vectorEffect="non-scaling-stroke" />
      <line x1="0" y1="11.4" x2="40" y2="11.4" stroke="#94a3b8" strokeWidth="1.4" opacity="0.8" vectorEffect="non-scaling-stroke" />
      <line x1="0" y1="20" x2="40" y2="20" stroke="#0e7490" strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </>
  ),
  // A young potted plant — the eco payoff of recycling.
  sapling: (
    <>
      <path d="M14 28 h12 l-1.5 8 h-9 z" fill="#b45309" stroke="#7c2d12" strokeWidth="1.2" />
      <rect x="13" y="26" width="14" height="3" rx="1" fill="#92400e" />
      <path d="M20 27 v-11" stroke="#15803d" strokeWidth="1.6" fill="none" />
      <path d="M20 21 q-6 -1 -7 -6 q6 0 7 6z" fill="#22c55e" />
      <path d="M20 18 q6 -1 7 -6 q-6 0 -7 6z" fill="#16a34a" />
      <path d="M20 15.5 q-3 -3 -2 -7 q4 3 2 7z" fill="#4ade80" />
    </>
  ),
  // A rack of renewable-energy storage batteries with green charge bars.
  batteryBank: (
    <>
      <rect x="8" y="14" width="24" height="20" rx="1.5" fill="#334155" stroke="#1e293b" strokeWidth="1.2" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={10 + i * 7.5} y={17} width={6} height={14} rx={1} fill="#0f766e" stroke="#134e4a" strokeWidth="0.8" />
          <rect x={11.5 + i * 7.5} y={15.6} width={3} height={2} rx={0.5} fill="#22d3ee" />
          <rect x={11 + i * 7.5} y={20} width={4} height={1.4} fill="#4ade80" />
          <rect x={11 + i * 7.5} y={22.5} width={4} height={1.4} fill="#4ade80" />
          <rect x={11 + i * 7.5} y={25} width={4} height={1.4} fill="#a3e635" />
        </g>
      ))}
      {/* power/charge lightning bolt on the middle cell */}
      <path d="M21.5 17.5 L17 24.5 L20 24.5 L18.5 30.5 L23.5 22.5 L20.5 22.5 L22 17.5 Z" fill="#facc15" stroke="#a16207" strokeWidth="0.6" strokeLinejoin="round" />
      <circle cx="20" cy="12.5" r="1" fill="#34d399" />
    </>
  ),
  // A faded painted recycle logo on the floor (flat decal, walkable) — three
  // chasing arrows around a triangle (the universal recycling mark), not solid
  // triangles. One arm drawn along the bottom edge, then rotated 120°/240°.
  // Universal recycling mark (real artwork, viewBox 122.88×121.52 scaled to fit
  // the 40×40 prop box), painted flat on the floor.
  recycleDecal: (
    <g opacity="0.25" transform="translate(0.5 0.7) scale(0.3255)">
      <path
        fillRule="evenodd"
        fill="#16a34a"
        d="M50.43.09,77.25,0C82.1,0,85.4.86,88.58,5l7.57,13.52,7.68-4.74L90.6,36.93l-26.74-.1L72,32.09,58.26,8.77A25.12,25.12,0,0,0,54.12,3,22.45,22.45,0,0,0,50.43.09ZM56.9,112.26l-25.73,0c-5.69-.88-9.34-4-10.43-8.26-.93-3.71,0-5.42,1.6-8.61,1.93-3.81,4.2-7.49,6.38-11.2l28.49.1-.31,27.92Zm-41-10L2.43,79.06C0,74.87-.91,71.57,1.12,66.72L9.05,53.4,1.11,49.13,27.73,49,41,72.24l-8.19-4.71L19.52,91.12a24.94,24.94,0,0,0-3,6.49,22.15,22.15,0,0,0-.64,4.63Zm92.91-60.6,12.91,22.25C123.82,69.26,123,74,119.8,77.05c-2.74,2.67-4.69,2.73-8.26,2.93-4.26.23-8.58.1-12.89.07L84.49,55.33l24.34-13.69Zm11.81,40.5-13.33,23.27c-2.41,4.21-4.82,6.64-10,7.3l-15.5-.21.27,9-13.4-23L82.11,75.4l0,9.45,27.08-.27a25,25,0,0,0,7.1-.68,22.2,22.2,0,0,0,4.33-1.76ZM21.26,30.57,34.08,8.27c3.6-4.5,8.1-6.11,12.36-4.91,3.68,1.05,4.71,2.7,6.67,5.69,2.33,3.57,4.38,7.38,6.51,11.13L45.28,44.8l-24-14.23Z"
      />
    </g>
  ),
  // --- history-vault / museum decor ---
  // A classical fluted stone column (base + shaft + capital).
  stonePillar: (
    <>
      <rect x="14" y="7" width="12" height="2.6" rx="0.5" fill="#d9d2c5" />
      <rect x="15" y="9.6" width="10" height="2" fill="#c7bfb0" />
      <rect x="16" y="11.6" width="8" height="20.4" fill="#cdc5b7" stroke="#a89f8e" strokeWidth="0.5" />
      <line x1="18" y1="11.6" x2="18" y2="32" stroke="#a89f8e" strokeWidth="0.5" />
      <line x1="20" y1="11.6" x2="20" y2="32" stroke="#a89f8e" strokeWidth="0.5" />
      <line x1="22" y1="11.6" x2="22" y2="32" stroke="#a89f8e" strokeWidth="0.5" />
      <rect x="14" y="32" width="12" height="2.6" rx="0.5" fill="#d9d2c5" />
      <rect x="13" y="34.6" width="14" height="2.4" rx="0.5" fill="#c7bfb0" />
    </>
  ),
  // A hanging heritage banner (crimson + gold) with a lion medallion.
  heritageBanner: (
    <>
      <rect x="12" y="5" width="16" height="2" rx="0.6" fill="#78350f" />
      <path d="M13 7 h14 v21 l-2.8 -2.8 -4.2 2.8 -4 -2.8 -3 2.8 z" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="0.8" />
      <rect x="13" y="7" width="14" height="3.2" fill="#f59e0b" />
      <circle cx="20" cy="17" r="3.4" fill="#fbbf24" stroke="#b45309" strokeWidth="0.6" />
      <path d="M18.4 18.4 q1.6 1.4 3.2 0 q0.4 -2.4 -1.6 -3 q-2 0.6 -1.6 3z" fill="#7c2d12" />
    </>
  ),
  // A colonial-era cannon on a wooden carriage.
  oldCannon: (
    <>
      <path d="M10 30 L28 26.5 L28.5 29.5 L13.5 33 z" fill="#6b4f3a" stroke="#4a3626" strokeWidth="0.6" />
      <rect x="11" y="19.5" width="17" height="5" rx="2.5" fill="#3f4653" stroke="#1e293b" strokeWidth="0.8" transform="rotate(-9 20 22)" />
      <circle cx="11.3" cy="21.4" r="1.1" fill="#1e293b" />
      <circle cx="14" cy="30.5" r="4" fill="#5b4636" stroke="#33261b" strokeWidth="1" />
      <circle cx="14" cy="30.5" r="1.2" fill="#33261b" />
      <circle cx="25.5" cy="30.5" r="3" fill="#5b4636" stroke="#33261b" strokeWidth="1" />
      <circle cx="25.5" cy="30.5" r="0.9" fill="#33261b" />
    </>
  ),
  // An ancient pottery urn with handles and a gold band.
  ancientUrn: (
    <>
      <ellipse cx="20" cy="16" rx="5" ry="1.6" fill="#92400e" />
      <path d="M15 16 q-1.5 4 0.5 9 q1.2 5.5 4.5 5.5 q3.3 0 4.5 -5.5 q2 -5 0.5 -9z" fill="#b45309" stroke="#7c2d12" strokeWidth="0.8" />
      <rect x="18" y="12.5" width="4" height="3.5" fill="#b45309" stroke="#7c2d12" strokeWidth="0.5" />
      <path d="M15.5 17.5 q-2.5 1.5 -1 4.5" fill="none" stroke="#7c2d12" strokeWidth="1.1" />
      <path d="M24.5 17.5 q2.5 1.5 1 4.5" fill="none" stroke="#7c2d12" strokeWidth="1.1" />
      <path d="M16 23 q4 2.2 8 0" stroke="#fcd34d" strokeWidth="0.9" fill="none" />
    </>
  ),
  // A wall torch — bracket + flame (a vault-ambiance ceiling/wall fixture).
  torchSconce: (
    <>
      <path d="M17.5 18 h5 l-1 -3.2 h-3 z" fill="#78350f" stroke="#57534e" strokeWidth="0.5" />
      <rect x="19.2" y="18" width="1.6" height="9" fill="#57534e" />
      <path d="M20 6 q3.2 4.2 1.6 8.4 q-1.6 2 -3.2 0 q-1.6 -4.2 1.6 -8.4z" fill="#f97316" />
      <path d="M20 9 q1.6 2.2 0.7 5.2 q-0.7 1 -1.5 0 q-0.7 -3 0.8 -5.2z" fill="#fde047" />
    </>
  ),
  // A stone lion-head sculpture on a plinth (the Lion City).
  // --- hero HQ decor ---
  // A standing hero banner on a pole with a gold lightning emblem.
  heroBanner: (
    <>
      <rect x="9" y="6" width="1.8" height="30" rx="0.6" fill="#78716c" />
      <path d="M10.5 8 h16 v20 l-8 -3.5 -8 3.5 z" fill="#4f46e5" stroke="#3730a3" strokeWidth="1" />
      <path d="M10.5 8 h16" stroke="#facc15" strokeWidth="1.4" />
      <path d="M18 12 l-3 7 h3 l-2 6 6 -8 h-3 l2 -5 z" fill="#facc15" />
    </>
  ),
  // A bronze/stone superhero statue on a pedestal — cape, arms akimbo, emblem.
  heroStatue: (
    <>
      <rect x="12" y="31" width="16" height="5" rx="1" fill="#78716c" stroke="#57534e" strokeWidth="1" />
      <rect x="14" y="28" width="12" height="3.5" fill="#8a8580" />
      <path d="M15 12 Q11 22 14 28 L20 25 L26 28 Q29 22 25 12 Z" fill="#9ca3af" opacity="0.9" />
      <rect x="17.5" y="22" width="2.6" height="6.5" fill="#a8a29e" />
      <rect x="20" y="22" width="2.6" height="6.5" fill="#a8a29e" />
      <path d="M16 12 Q20 9 24 12 L23 23 Q20 25 17 23 Z" fill="#b6b1ab" stroke="#78716c" strokeWidth="0.6" />
      <path d="M16.5 14 L12.5 18 L15.5 18 L17.5 15 Z" fill="#a8a29e" />
      <path d="M23.5 14 L27.5 18 L24.5 18 L22.5 15 Z" fill="#a8a29e" />
      <circle cx="20" cy="8.6" r="3.2" fill="#c4bfb8" stroke="#78716c" strokeWidth="0.6" />
      <path d="M20 15 l-1.2 2.6 h1.2 l-.8 2 2.2 -2.8 h-1.2 l.8 -1.8 z" fill="#facc15" opacity="0.85" />
    </>
  ),
  // A glowing power cell / energy canister for the charger rooms.
  powerCell: (
    <>
      <rect x="14" y="13" width="12" height="19" rx="2" fill="#1e293b" stroke="#0f172a" strokeWidth="1" />
      <rect x="17" y="10.5" width="6" height="3" rx="1" fill="#475569" />
      <rect x="16" y="15" width="8" height="15" rx="1.2" fill="#0e2a3a" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x="17.2" y={16.5 + i * 3.3} width="5.6" height="2" rx="1" fill="#22d3ee" opacity={0.9 - i * 0.18} />
      ))}
    </>
  ),
  // A hero mission-control console with a glowing screen + lightning emblem.
  heroConsole: (
    <>
      <path d="M9 20 h22 l2 13 h-26 z" fill="#3730a3" stroke="#312e81" strokeWidth="1" />
      <rect x="11" y="9" width="18" height="11.5" rx="1.5" fill="#0f172a" stroke="#4338ca" strokeWidth="1.2" />
      <path d="M13 15.5 l2 -2 2 3 2 -3 2 2" fill="none" stroke="#22d3ee" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M24.5 11 l-1.6 3.6 h1.6 l-1 2.6 3 -3.8 h-1.6 l1 -2.4 z" fill="#facc15" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={14 + i * 3} cy="28" r="1" fill={["#22d3ee", "#34d399", "#f59e0b"][i]} />
      ))}
    </>
  ),
  // A glass display case holding a dummy hero suit on a stand.
  suitCase: (
    <>
      <rect x="10" y="33" width="20" height="3" rx="1" fill="#3730a3" />
      <rect x="11" y="8" width="18" height="25" rx="1.5" fill="#1e1b4b" stroke="#4338ca" strokeWidth="1.4" />
      <rect x="13" y="10" width="14" height="21" rx="1" fill="#312e81" opacity="0.45" />
      <path d="M14.5 11 l2.6 0 -2.6 7 z" fill="#c7d2fe" opacity="0.3" />
      <rect x="17.6" y="25" width="2.2" height="6" fill="#4338ca" />
      <rect x="20.2" y="25" width="2.2" height="6" fill="#4338ca" />
      <path d="M16.5 16 Q20 13.5 23.5 16 L23 26 Q20 27.5 17 26 Z" fill="#6366f1" />
      <circle cx="20" cy="13.5" r="2.5" fill="#818cf8" />
      <path d="M20 18 l-1 2.2 h1 l-.7 1.8 1.8 -2.4 h-1 l.7 -1.6 z" fill="#facc15" />
    </>
  ),
  // A glass display case of hero gear — a shield, a gauntlet and an energy bolt.
  weaponCase: (
    <>
      <rect x="9" y="31" width="22" height="3" rx="1" fill="#3730a3" />
      <rect x="9" y="9" width="22" height="22" rx="1.5" fill="#1e1b4b" stroke="#4338ca" strokeWidth="1.4" />
      <rect x="11" y="11" width="18" height="18" rx="1" fill="#312e81" opacity="0.45" />
      <path d="M14 14 l4 -1.4 4 1.4 v3.4 a4 4 0 0 1 -8 0 z" fill="#eab308" stroke="#a16207" strokeWidth="0.8" />
      <path d="M18 13 v6.4" stroke="#fef9c3" strokeWidth="0.6" />
      <rect x="13" y="23.5" width="6.5" height="3.5" rx="1.4" fill="#22d3ee" stroke="#0e7490" strokeWidth="0.6" />
      <path d="M25 22 l-2 4 h2 l-1.3 3.2 3.2 -4.2 h-2 l1.3 -3 z" fill="#facc15" />
    </>
  ),
  // --- festival decor ---
  // Stretched string of triangular pennants that follows a gentle swag droop.
  bunting: (
    <>
      <path d="M1 7 q 19 11 38 0" fill="none" stroke="#78716c" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {[4, 10, 16, 22, 28, 34].map((x, i) => {
        const y = 7 + Math.sin((x / 38) * Math.PI) * 5.5;
        return (
          <polygon
            key={i}
            points={`${x - 2.4},${y} ${x + 2.4},${y} ${x},${y + 6}`}
            fill={["#fb7185", "#fbbf24", "#a78bfa", "#34d399", "#38bdf8", "#f472b6"][i % 6]}
          />
        );
      })}
    </>
  ),
  // A hanging paper lantern (ceiling prop).
  lantern: (
    <>
      <line x1="20" y1="3" x2="20" y2="9" stroke="#78716c" strokeWidth="1" />
      <rect x="14.5" y="8.5" width="11" height="2.4" rx="1" fill="#fca5a5" />
      <ellipse cx="20" cy="17.5" rx="7.5" ry="9" fill="#ef4444" stroke="#b91c1c" strokeWidth="1" />
      <ellipse cx="17.3" cy="14" rx="1.5" ry="3" fill="#fecaca" opacity="0.7" />
      <rect x="14.5" y="24" width="11" height="2.4" rx="1" fill="#fca5a5" />
      <line x1="20" y1="26.4" x2="20" y2="31" stroke="#fbbf24" strokeWidth="1.6" />
    </>
  ),
  // A hawker food cart with a canopy and a pot of steam.
  foodCart: (
    <>
      <rect x="8" y="20" width="24" height="11" rx="1.5" fill="#b45309" stroke="#7c2d12" strokeWidth="1" />
      <rect x="8" y="17" width="24" height="3.5" rx="1" fill="#dc2626" />
      <rect x="7" y="11" width="26" height="3" rx="1.2" fill="#facc15" />
      {[9, 15, 21, 27].map((x, i) => (
        <line key={i} x1={x} y1="14" x2={x + 3} y2="17" stroke="#f59e0b" strokeWidth="0.6" />
      ))}
      <circle cx="13" cy="33" r="2.4" fill="#374151" />
      <circle cx="27" cy="33" r="2.4" fill="#374151" />
      <ellipse cx="20" cy="24" rx="4" ry="2" fill="#78716c" />
      <path d="M18 22c-1-2 1-3 0-5M22 22c-1-2 1-3 0-5" fill="none" stroke="#cbd5e1" strokeWidth="0.9" opacity="0.7" />
    </>
  ),
  // A festival drum on a little stand.
  drum: (
    <>
      <path d="M11 16h18l-2 12h-14z" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1" />
      <ellipse cx="20" cy="16" rx="9" ry="3" fill="#fef3c7" stroke="#b45309" strokeWidth="1" />
      <ellipse cx="20" cy="16" rx="9" ry="3" fill="none" stroke="#f59e0b" strokeWidth="0.6" />
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1={12 + i * 4} y1="17.5" x2={11 + i * 4} y2="26.5" stroke="#fcd34d" strokeWidth="0.7" />
      ))}
      <rect x="14" y="28" width="2" height="5" fill="#7c2d12" />
      <rect x="24" y="28" width="2" height="5" fill="#7c2d12" />
    </>
  ),
  // A dhol — Indian double-headed barrel drum with zigzag rope lacing.
  dhol: (
    <>
      <path d="M11 18 Q20 15.5 29 18 L29 26 Q20 28.5 11 26 Z" fill="#b45309" stroke="#7c2d12" strokeWidth="1" />
      <path d="M12.5 18.5 L14.5 25.5 L16.5 18.5 L18.5 25.5 L20.5 18.5 L22.5 25.5 L24.5 18.5 L26.5 25.5" fill="none" stroke="#fca5a5" strokeWidth="0.8" strokeLinejoin="round" />
      <ellipse cx="11" cy="22" rx="2.4" ry="4.4" fill="#fde68a" stroke="#7c2d12" strokeWidth="1" />
      <ellipse cx="29" cy="22" rx="2.4" ry="4.4" fill="#fef3c7" stroke="#7c2d12" strokeWidth="1" />
      <rect x="15.5" y="27" width="1.6" height="6" rx="0.6" fill="#57534e" />
      <rect x="22.9" y="27" width="1.6" height="6" rx="0.6" fill="#57534e" />
    </>
  ),
  // A diya — small clay oil lamp with a flame (Diwali). Flat ground detail.
  diya: (
    <>
      <ellipse cx="20" cy="23" rx="10" ry="3.2" fill="#fef3c7" opacity="0.35" />
      <path d="M20 12 q 2.4 3 0 6 q -2.4 -3 0 -6z" fill="#fbbf24" />
      <path d="M20 14 q 1.3 1.9 0 3.4 q -1.3 -1.5 0 -3.4z" fill="#f97316" />
      <rect x="19.4" y="18.5" width="1.2" height="3" fill="#78350f" />
      <path d="M12 21 q 8 4 16 0 q -1.6 4 -8 4 q -6.4 0 -8 -4z" fill="#c2410c" stroke="#7c2d12" strokeWidth="0.8" />
      <ellipse cx="20" cy="21" rx="8" ry="2.2" fill="#9a3412" />
    </>
  ),
  // A rangoli — colourful symmetric floor pattern (Diwali). Flat ground detail.
  rangoli: (
    <>
      <circle cx="20" cy="20" r="13" fill="none" stroke="#f472b6" strokeWidth="1" opacity="0.45" />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <circle key={`o${i}`} cx={20 + Math.cos(a) * 11} cy={20 + Math.sin(a) * 11} r="1.5" fill={["#f472b6", "#fbbf24", "#38bdf8", "#a855f7"][i % 4]} />;
      })}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const x = 20 + Math.cos(a) * 6.5;
        const y = 20 + Math.sin(a) * 6.5;
        return (
          <ellipse
            key={`p${i}`}
            cx={x}
            cy={y}
            rx="2.9"
            ry="1.4"
            fill={["#fb7185", "#f59e0b", "#34d399", "#818cf8"][i % 4]}
            opacity="0.85"
            transform={`rotate(${(a * 180) / Math.PI} ${x} ${y})`}
          />
        );
      })}
      <circle cx="20" cy="20" r="3" fill="#facc15" stroke="#f97316" strokeWidth="0.8" />
      <circle cx="20" cy="20" r="1.2" fill="#dc2626" />
    </>
  ),
  // A potted plant.
  plantpot: (
    <>
      <path d="M13 26h14l-2 8h-10z" fill="#c2410c" stroke="#7c2d12" strokeWidth="1" />
      <rect x="12" y="24" width="16" height="3" rx="1" fill="#ea580c" />
      <path d="M20 24c-1-6-6-7-8-10 4 0 7 2 8 6 1-4 4-6 8-6-2 3-7 4-8 10z" fill="#16a34a" />
      <path d="M20 24c0-5 0-9 0-12" fill="none" stroke="#15803d" strokeWidth="1" />
      <circle cx="16" cy="15" r="1.6" fill="#f472b6" />
      <circle cx="24" cy="16" r="1.6" fill="#fbbf24" />
    </>
  ),
  // A little ground flower (pink) — flat garden detail.
  flower: (
    <>
      <path d="M20 34 Q19 27 20 19" fill="none" stroke="#15803d" strokeWidth="1.6" />
      <path d="M20 28 q -4 -1.5 -6.5 -3.5 q 3.5 0.2 6.5 2.2" fill="#22c55e" />
      <path d="M20 25 q 4 -1.5 6.5 -3.5 q -3.5 0.2 -6.5 2.2" fill="#16a34a" />
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        return <circle key={i} cx={20 + Math.cos(a) * 4} cy={15 + Math.sin(a) * 4} r="3" fill="#f472b6" />;
      })}
      <circle cx="20" cy="15" r="2.6" fill="#fde047" />
    </>
  ),
  // A little white daisy — flat garden detail.
  daisy: (
    <>
      <path d="M20 34 Q21 27 20 19" fill="none" stroke="#15803d" strokeWidth="1.6" />
      <path d="M20 27 q 4 -1.5 6.5 -3.5 q -3.5 0.2 -6.5 2.2" fill="#22c55e" />
      {Array.from({ length: 7 }).map((_, i) => {
        const a = (i / 7) * Math.PI * 2;
        return <circle key={i} cx={20 + Math.cos(a) * 4} cy={15 + Math.sin(a) * 4} r="2.4" fill="#fff" stroke="#e2e8f0" strokeWidth="0.4" />;
      })}
      <circle cx="20" cy="15" r="2.6" fill="#f59e0b" />
    </>
  ),
  // A tuft of grass blades (flat ground detail).
  grass: (
    <>
      {[[12, -4], [15, -1], [18, 1.5], [21, -1.5], [24, 3], [27, -1], [30, 2]].map(([x, lean], i) => (
        <path
          key={i}
          d={`M${x} 33 Q ${x + lean} 25 ${x + lean * 1.7} 15`}
          fill="none"
          stroke={i % 2 ? "#65a30d" : "#4d7c0f"}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      ))}
    </>
  ),
  // A wooden crate with a spiky durian (king of fruits) flanked by round fruit.
  fruitCrate: (
    <>
      <rect x="9" y="20" width="22" height="13" rx="1" fill="#a16207" stroke="#713f12" strokeWidth="1" />
      <line x1="9" y1="25" x2="31" y2="25" stroke="#713f12" strokeWidth="0.8" />
      <line x1="16" y1="20" x2="16" y2="33" stroke="#713f12" strokeWidth="0.7" opacity="0.6" />
      <line x1="24" y1="20" x2="24" y2="33" stroke="#713f12" strokeWidth="0.7" opacity="0.6" />
      <circle cx="13" cy="18.5" r="3" fill="#ef4444" />
      <circle cx="27" cy="18.5" r="3" fill="#f97316" />
      {/* durian — a khaki oval husk under long pyramid spikes, with a short stem */}
      <rect x="19.2" y="9.2" width="1.7" height="3" rx="0.6" fill="#6b4f2a" />
      {Array.from({ length: 13 }).map((_, i) => {
        const a = (i / 13) * Math.PI * 2 - Math.PI / 2;
        const bx = 20 + Math.cos(a) * 3.7;
        const by = 16 + Math.sin(a) * 4.1;
        const tx = 20 + Math.cos(a) * 6.5;
        const ty = 16 + Math.sin(a) * 7.1;
        const px = -Math.sin(a) * 1.05;
        const py = Math.cos(a) * 1.05;
        return <polygon key={i} points={`${bx + px},${by + py} ${bx - px},${by - py} ${tx},${ty}`} fill="#7c8a3e" />;
      })}
      <ellipse cx="20" cy="16" rx="4.1" ry="4.5" fill="#94a350" stroke="#5f6b2c" strokeWidth="0.5" />
      {/* facet spikes across the husk so it reads as a durian, not a ball */}
      {[[18, 14.4], [21.8, 14.6], [20, 17.2], [17.4, 16.8], [22.4, 16.6], [19.9, 13.4]].map(([x, y], i) => (
        <path key={`f${i}`} d={`M${x - 1} ${y + 1} L${x} ${y - 1.2} L${x + 1} ${y + 1}`} fill="#7c8a3e" stroke="#5f6b2c" strokeWidth="0.35" strokeLinejoin="round" />
      ))}
    </>
  ),
  // A round wooden stool.
  stool: (
    <>
      <ellipse cx="20" cy="20" rx="8" ry="3.2" fill="#b45309" stroke="#7c2d12" strokeWidth="1" />
      <ellipse cx="20" cy="19" rx="8" ry="3.2" fill="#d97706" />
      <rect x="13.5" y="21" width="2" height="10" fill="#7c2d12" transform="rotate(6 14.5 26)" />
      <rect x="24.5" y="21" width="2" height="10" fill="#7c2d12" transform="rotate(-6 25.5 26)" />
      <rect x="19" y="21.5" width="2" height="10" fill="#92400e" />
    </>
  ),
};

/** Maps a carry item's `icon` to its themed prop art (direct-delivery items). */
const ITEM_PROP: Record<string, string> = { key: "key", lion: "merlion", flag: "flag", note: "scroll" };

/** Per-scene exit-door skins, keyed by `room.scene`; falls back to the generic door. */
const DOOR_ART: Record<string, { open: string; locked: string }> = {
  festival: { open: "festivalGateOpen", locked: "festivalGateLocked" },
};

/** Subtle repeating floor textures for the top-down tiles, keyed by `floorKind`
 *  (per-cell override, else the room's). Overlaid on the floor gradient; a kind
 *  with no entry just shows the plain gradient. */
/** A tiling desaturated fractal-noise background at a given frequency + opacity,
 *  for worn floor grain. Unique filter id per call to avoid data-URI id clashes. */
const noiseBg = (id: string, freq: number, opacity: number) =>
  `url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='200'%20height='200'%3E%3Cfilter%20id='${id}'%3E%3CfeTurbulence%20type='fractalNoise'%20baseFrequency='${freq}'%20numOctaves='2'%20stitchTiles='stitch'/%3E%3CfeColorMatrix%20type='saturate'%20values='0'/%3E%3C/filter%3E%3Crect%20width='100%25'%20height='100%25'%20filter='url(%23${id})'%20opacity='${opacity}'/%3E%3C/svg%3E")`;

/** Seamless honeycomb lattice (hero-patterns "Hexagons"), tinted indigo — the
 *  signature high-tech HQ floor for the superhero-suit escape room. Thin,
 *  non-rectangular outlines that read as a hero base without boxing objects. */
const HEX_TILE =
  "url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='28'%20height='49'%3E%3Cpath%20fill='%23a5b4fc'%20fill-opacity='0.84'%20d='M13.99%209.25l13%207.5v15l-13%207.5L1%2031.75v-15l12.99-7.5zM3%2017.9v12.7l10.99%206.34%2011-6.35V17.9l-11-6.34L3%2017.9zM0%2015l12.98-7.5V0h-2v6.35L0%2012.69v2.3zm0%2018.5L12.98%2041v8h-2v-6.85L0%2035.81v-2.3zM15%200v7.5L27.99%2015H28v-2.31h-.01L17%206.35V0h-2zm0%2049v-8l12.99-7.5H28v2.31h-.01L17%2042.15V49h-2z'/%3E%3C/svg%3E\")";

/**
 * Continuous floor textures — ONE repeating background per room, not a grid of
 * bordered tile divs, so they never frame a small object (e.g. the note) as a
 * box. Grid patterns are kept FINER than a sprite so lines cross through it, not
 * around it. Only `metal` keeps a discrete plate grid (FLOOR_GRID.metal), where
 * the plates are the point and its seams are hairlines.
 */
const FLOOR_TEXTURE: Record<string, React.CSSProperties> = {
  metal: {
    backgroundImage: noiseBg("nMe", 0.6, 0.1),
    backgroundSize: "200px 200px",
  },
  // Concrete (recycling plant) — a poured-slab industrial floor: widely spaced
  // control joints (big slabs, not tight tiles) + heavy grey mottle. Continuous,
  // so nothing gets boxed.
  concrete: {
    backgroundImage:
      "repeating-linear-gradient(0deg, rgba(30,41,59,.11) 0 2px, transparent 2px 132px)," +
      "repeating-linear-gradient(90deg, rgba(30,41,59,.11) 0 2px, transparent 2px 132px)," +
      "radial-gradient(70% 55% at 32% 38%, rgba(0,0,0,.06), transparent 65%)," +
      noiseBg("nCo", 0.45, 0.11),
    backgroundSize: "132px 132px, 132px 132px, 100% 100%, 220px 220px",
  },
  // Stone (history vault) — warm flagstone: big slab joints + brown mottle. Same
  // continuous approach as concrete, so nothing gets boxed.
  stone: {
    backgroundImage:
      "repeating-linear-gradient(0deg, rgba(87,63,42,.13) 0 2px, transparent 2px 120px)," +
      "repeating-linear-gradient(90deg, rgba(87,63,42,.13) 0 2px, transparent 2px 120px)," +
      "radial-gradient(65% 55% at 30% 35%, rgba(120,90,60,.07), transparent 60%)," +
      noiseBg("nSt", 0.5, 0.1),
    backgroundSize: "120px 120px, 120px 120px, 100% 100%, 210px 210px",
  },
  // Wood — horizontal plank seams + shade banding + fine grain + noise (all
  // directional, so nothing gets boxed).
  wood: {
    backgroundImage:
      "repeating-linear-gradient(0deg, rgba(60,30,8,.2) 0 1.5px, transparent 1.5px 15px)," +
      "repeating-linear-gradient(0deg, rgba(0,0,0,.045) 0 15px, rgba(255,255,255,.03) 15px 30px)," +
      "repeating-linear-gradient(90deg, rgba(90,50,15,.04) 0 1px, transparent 1px 5px)," +
      noiseBg("nWo", 0.9, 0.07),
    backgroundSize: "auto, auto, auto, 200px 200px",
  },
  // Ceramic — a fine continuous grout grid (finer than a sprite) + soft noise.
  tile: {
    backgroundImage:
      "linear-gradient(rgba(0,0,0,.1) 1px, transparent 1px)," +
      "linear-gradient(90deg, rgba(0,0,0,.1) 1px, transparent 1px)," +
      noiseBg("nTi", 0.7, 0.05),
    backgroundSize: "26px 26px, 26px 26px, 180px 180px",
  },
  // Panel (hero HQ) — a glowing honeycomb tech-plate lattice (the signature
  // superhero-base floor) over a soft corner sheen + opposite shade (room-level
  // depth) + noise. The hex outlines are thin and non-axis-aligned, so nothing
  // gets framed as a box.
  panel: {
    backgroundImage:
      HEX_TILE +
      "," +
      "radial-gradient(130% 100% at 25% 15%, rgba(255,255,255,.07), transparent 55%)," +
      "radial-gradient(130% 100% at 82% 92%, rgba(2,6,23,.12), transparent 55%)," +
      noiseBg("nPa", 0.6, 0.05),
    backgroundSize: "46px 80px, 100% 100%, 100% 100%, 200px 200px",
  },
};

/** One embossed diamond stud (light top-left edge, dark bottom-right). Tiled per
 *  plate at a % size so each plate always shows a whole number of diamonds. */
const DIAMOND_TILE = `url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='22'%20height='22'%3E%3Cpolygon%20points='11,5%2017,11%2011,17%205,11'%20fill='rgba(203,213,225,.14)'/%3E%3Cpath%20d='M5%2011%20L11%205%20L17%2011'%20fill='none'%20stroke='rgba(241,245,249,.32)'%20stroke-width='1.1'/%3E%3Cpath%20d='M5%2011%20L11%2017%20L17%2011'%20fill='none'%20stroke='rgba(2,6,23,.36)'%20stroke-width='1.2'/%3E%3C/svg%3E")`;

/** Stable pseudo-random 0–1 from a string (FNV-1a) — so a tile's look is fixed
 *  per position and doesn't flicker between renders. */
function seededRand(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Per-plate variation for a tiled floor: a seam on every plate, plus a random
 *  mix of worn (darker), polished (lighter) and missing (recessed, no tread)
 *  plates. `tread` says whether the diamond studs are drawn on this plate. */
function tileVariant(t: number): { backgroundColor?: string; boxShadow: string; tread: boolean } {
  const seam = "inset 0 0 0 1px rgba(15,23,42,.1)";
  if (t < 0.07) return { backgroundColor: "rgba(2,6,23,.62)", boxShadow: `${seam}, inset 0 0 9px 2px rgba(0,0,0,.55)`, tread: false };
  if (t < 0.22) return { backgroundColor: "rgba(2,6,23,.20)", boxShadow: seam, tread: true };
  if (t < 0.33) return { backgroundColor: "rgba(226,232,240,.09)", boxShadow: seam, tread: true };
  return { boxShadow: seam, tread: true };
}

/** Per-kind floor grid — kept ONLY for metal tread plate (discrete plates are the
 *  point there); its seams are hairlines so a small object on a plate isn't boxed.
 *  Every other kind uses a continuous FLOOR_TEXTURE instead. */
const FLOOR_GRID: Record<
  string,
  { cols: (w: number, h: number) => number; rows: (w: number, h: number) => number; tile: (seed: number) => React.CSSProperties }
> = {
  metal: {
    cols: (w) => Math.max(1, Math.round(w / 38)),
    rows: (_w, h) => Math.max(1, Math.round(h / 38)),
    tile: (t) => {
      const v = tileVariant(t);
      return {
        backgroundColor: v.backgroundColor,
        boxShadow: v.boxShadow,
        backgroundImage: v.tread ? DIAMOND_TILE : undefined,
        backgroundSize: v.tread ? "33.333% 33.333%" : undefined,
      };
    },
  },
};

/** Renders a small themed prop SVG (carriable / sink / door / note). */
function Prop({ art, className, style }: { art: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 40 40" className={className} style={style}>
      {PROP_ART[art]}
    </svg>
  );
}

/** Glow colour for a hero core, keyed by its station id (💚 / 💙 / 💛). */
const CORE_COLOR: Record<string, string> = {
  kindness: "#22c55e",
  honesty: "#3b82f6",
  fairness: "#eab308",
};

/** Charged-core sphere gradient in the core's own colour (keyed by station). */
const CORE_GRADIENT: Record<string, string> = {
  kindness: "radial-gradient(circle at 35% 30%, #bbf7d0, #22c55e 55%, #15803d)",
  honesty: "radial-gradient(circle at 35% 30%, #bfdbfe, #3b82f6 55%, #1e40af)",
  fairness: "radial-gradient(circle at 35% 30%, #fef9c3, #eab308 55%, #a16207)",
};
/** Uncharged / empty core — a dim grey sphere (no colour until charged). */
const CORE_DIM = "radial-gradient(circle at 35% 30%, #e2e8f0, #94a3b8 55%, #475569)";
const CORE_CHARGED_FALLBACK = "radial-gradient(circle at 35% 30%, #fde68a, #f59e0b 55%, #b45309)";

/** The hero suit on a stand, standing by the exit. Its chest sockets light up
 *  (one per core, in that core's colour) as charged cores are delivered. */
function SuitModel({ cores, className }: { cores: { color: string; lit: boolean }[]; className?: string }) {
  const n = cores.length;
  return (
    <svg viewBox="0 0 48 66" className={className} aria-hidden>
      {/* stand + ground shadow */}
      <ellipse cx="24" cy="62" rx="13" ry="2.6" fill="rgba(0,0,0,.3)" />
      <rect x="22.5" y="52" width="3" height="10" fill="#475569" />
      <ellipse cx="24" cy="62" rx="6" ry="1.6" fill="#334155" />
      {/* cape */}
      <path d="M13 21 Q7 44 12 55 L24 49 L36 55 Q41 44 35 21 Z" fill="#4c1d95" opacity="0.85" />
      {/* legs + boots */}
      <rect x="18" y="41" width="5.5" height="15" rx="2" fill="#3730a3" />
      <rect x="24.5" y="41" width="5.5" height="15" rx="2" fill="#3730a3" />
      <rect x="16.5" y="53" width="8" height="4.5" rx="1.6" fill="#dc2626" />
      <rect x="23.5" y="53" width="8" height="4.5" rx="1.6" fill="#dc2626" />
      {/* arms */}
      <rect x="9.5" y="22" width="5" height="19" rx="2.5" fill="#4338ca" />
      <rect x="33.5" y="22" width="5" height="19" rx="2.5" fill="#4338ca" />
      {/* torso */}
      <path d="M15 20 Q24 15 33 20 L32 43 Q24 47 16 43 Z" fill="#4f46e5" stroke="#3730a3" strokeWidth="1" />
      {/* belt */}
      <rect x="16" y="39.5" width="16" height="3.4" rx="1" fill="#facc15" />
      <rect x="22" y="39.5" width="4" height="3.4" fill="#f59e0b" />
      {/* head / helmet */}
      <circle cx="24" cy="11.5" r="7.5" fill="#6366f1" stroke="#3730a3" strokeWidth="1" />
      <path d="M17.5 10.5 h13" stroke="#c7d2fe" strokeWidth="1.3" strokeLinecap="round" />
      {/* chest sockets — one per core, centred as a row */}
      {cores.map((c, i) => {
        const cx = 24 + (i - (n - 1) / 2) * 6;
        const cy = 28;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r="3" fill="#1e1b4b" stroke="#312e81" strokeWidth="0.8" />
            {c.lit && (
              <>
                <circle cx={cx} cy={cy} r="4" fill="none" stroke={c.color} strokeWidth="1" opacity="0.55" className="animate-pulse" />
                <circle cx={cx} cy={cy} r="2.4" fill={c.color} />
                <circle cx={cx - 0.8} cy={cy - 0.8} r="0.9" fill="#fff" opacity="0.85" />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** The Time Capsule that stands in the history vault's exit room. Three slots run
 *  down its face; each fills with a national treasure (its emoji) as it's placed. */
function TimeCapsuleModel({ slots, className }: { slots: { emoji: string; filled: boolean }[]; className?: string }) {
  return (
    <svg viewBox="0 0 48 66" className={className} aria-hidden>
      <ellipse cx="24" cy="63" rx="14" ry="2.6" fill="rgba(0,0,0,.28)" />
      {/* stone plinth */}
      <rect x="12" y="55" width="24" height="7" rx="1.5" fill="#b3aa99" stroke="#7d7565" strokeWidth="1" />
      <rect x="14" y="52" width="20" height="3.5" fill="#cdc5b7" />
      {/* metallic capsule body + highlight + bands + gold seal */}
      <path d="M15 53 L15 20 Q15 8 24 8 Q33 8 33 20 L33 53 Z" fill="#94a3b8" stroke="#475569" strokeWidth="1.4" />
      <path d="M18.5 50 L18.5 20 Q18.5 12 22 10" fill="none" stroke="#e2e8f0" strokeWidth="1.4" opacity="0.7" />
      <rect x="15" y="17.5" width="18" height="2" fill="#64748b" />
      <rect x="15" y="48.5" width="18" height="2" fill="#64748b" />
      <circle cx="24" cy="13.5" r="3" fill="#fbbf24" stroke="#b45309" strokeWidth="0.8" />
      <path d="M22.7 13.5 l1 1 1.6 -2" fill="none" stroke="#78350f" strokeWidth="0.7" />
      {/* treasure slots */}
      {slots.map((s, i) => {
        const cy = 24 + i * 8.5;
        return (
          <g key={i}>
            <circle cx="24" cy={cy} r="3.8" fill="#1e293b" stroke="#475569" strokeWidth="0.8" />
            {s.filled && (
              <>
                <circle cx="24" cy={cy} r="4.7" fill="none" stroke="#fbbf24" strokeWidth="1" opacity="0.6" className="animate-pulse" />
                <text x="24" y={cy} fontSize="5" textAnchor="middle" dominantBaseline="central">
                  {s.emoji}
                </text>
              </>
            )}
          </g>
        );
      })}
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
