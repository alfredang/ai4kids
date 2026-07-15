"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TalkingBuddy } from "@/components/portal/TalkingBuddy";
import { BUDDY_COLORS, DEFAULT_BUDDY_COLOR } from "@/lib/buddy-colors";

type Turn = { role: "user" | "buddy"; content: string };

export default function BuddyPage() {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Turn[]>([]);
  const [audio, setAudio] = useState<string | null>(null);
  const [speakText, setSpeakText] = useState<string | null>(null);
  const [micSupported, setMicSupported] = useState(false);
  const [micError, setMicError] = useState("");
  const [buddyName, setBuddyName] = useState<string | null>(null);
  const [buddyColor, setBuddyColor] = useState<string>(DEFAULT_BUDDY_COLOR);
  const [customising, setCustomising] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMicSupported(typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Restore the current chat thread from the server on mount (survives refresh).
  useEffect(() => {
    fetch("/api/learn/buddy/history")
      .then((r) => (r.ok ? r.json() : { messages: [] }))
      .then((d) => { if (Array.isArray(d.messages) && d.messages.length) setMessages(d.messages); })
      .catch(() => {});
  }, []);

  // Load the kid's buddy name + colour.
  useEffect(() => {
    fetch("/api/learn/buddy/profile")
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: { name?: string; color?: string }) => {
        if (d.name) { setBuddyName(d.name); setNameInput(d.name); }
        if (d.color) setBuddyColor(d.color);
      })
      .catch(() => {});
  }, []);

  async function ask(message: string) {
    const m = message.trim();
    if (!m || busy) return;
    setBusy(true);
    setText("");
    setAudio(null);
    setSpeakText(null);
    setMessages((prev) => [...prev, { role: "user", content: m }]);

    // 1. Get the reply text.
    let reply = "Oops, my ears aren't working right now — try again in a moment!";
    try {
      const res = await fetch("/api/learn/buddy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: m }),
      });
      const data = await res.json();
      reply = data.reply ?? "Hmm, let's try that again!";
    } catch { /* keep the fallback line */ }

    // 2. Fetch the voice, THEN reveal the reply + play it together (in sync).
    let audioUrl: string | null = null;
    try {
      const sres = await fetch("/api/learn/buddy/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply }),
      });
      audioUrl = (await sres.json()).audio ?? null;
    } catch { /* no audio → browser voice */ }

    setMessages((prev) => [...prev, { role: "buddy", content: reply }]);
    if (audioUrl) setAudio(audioUrl);
    else setSpeakText(reply);
    setBusy(false);
  }

  async function speak(t: string) {
    setAudio(null);
    setSpeakText(null);
    try {
      const sres = await fetch("/api/learn/buddy/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const sdata = await sres.json();
      if (sdata.audio) setAudio(sdata.audio);
      else setSpeakText(t); // server TTS unavailable → browser voice
    } catch {
      setSpeakText(t);
    }
  }

  // Tap-to-talk: record mic audio, then transcribe via Cloudflare Whisper.
  async function startRec() {
    setMicError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        await transcribeAndAsk(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (e) {
      setRecording(false);
      const name = e instanceof Error ? e.name : "";
      console.error("[buddy] mic error", e);
      setMicError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "I need permission to use the microphone. Allow it in your browser, or just type below! 🎤"
          : name === "NotFoundError"
            ? "I couldn't find a microphone — you can type to me instead! ⌨️"
            : "I can't reach the microphone right now — please type below! 🎤",
      );
    }
  }

  function stopRec() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  async function transcribeAndAsk(blob: Blob) {
    setTranscribing(true);
    let said = "";
    try {
      const res = await fetch("/api/learn/buddy/listen", {
        method: "POST",
        headers: { "Content-Type": blob.type || "application/octet-stream" },
        body: blob,
      });
      const data = await res.json();
      said = (data.text ?? "").trim();
    } catch { /* ignore — no transcript */ }
    setTranscribing(false);
    if (said) ask(said);
  }

  function clearChat() {
    // Resets the buddy's memory + this view. The log is kept for parents.
    fetch("/api/learn/buddy/history", { method: "DELETE" }).catch(() => {});
    setMessages([]);
    setAudio(null);
    setSpeakText(null);
    if (typeof window !== "undefined" && "speechSynthesis" in window) speechSynthesis.cancel();
  }

  async function saveProfile(patch: { name?: string; color?: string }) {
    try {
      const res = await fetch("/api/learn/buddy/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = await res.json();
      if (d.ok) { setBuddyName(d.name ?? null); setBuddyColor(d.color ?? DEFAULT_BUDDY_COLOR); }
    } catch { /* ignore */ }
  }

  const mood: "idle" | "happy" | "thinking" | "listening" =
    busy ? "thinking" : recording || transcribing ? "listening" : "happy";
  const status = busy
    ? "Thinking… 💭"
    : transcribing
      ? "Listening… 👂"
      : recording
        ? "I'm listening — tap Stop when you're done! 🎤"
        : messages.length === 0
          ? "Tap the mic and say hi, or type below! 👋"
          : "";
  const title = buddyName || "Talking Buddy";

  return (
    <div className="mx-auto max-w-4xl">
      {/* Top nav */}
      <div className="flex items-center justify-between">
        <Link href="/learn" className="font-fun text-sm font-600 text-slate-400 hover:text-coral">← Back to activities</Link>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="rounded-full bg-slate-100 px-3 py-1 font-fun text-xs font-700 text-slate-500 transition hover:bg-slate-200"
          >
            New chat 🧹
          </button>
        )}
      </div>

      <div className="mt-3 grid items-start gap-4 md:grid-cols-2">
        {/* Left: buddy + controls */}
        <div className="space-y-4">
          {/* Buddy stage */}
          <div className="relative rounded-[2rem] bg-gradient-to-b from-sky-100 to-white p-6 text-center shadow-sm ring-1 ring-sky-100">
            <button
              onClick={() => setCustomising((v) => !v)}
              className="absolute right-4 top-4 rounded-full bg-white/70 px-3 py-1 font-fun text-xs font-700 text-slate-500 ring-1 ring-slate-100 transition hover:bg-white"
            >
              {customising ? "Done" : "✏️ Customise"}
            </button>
            <h1 className="font-fun text-2xl font-700 text-slate-900">🤖 {title}</h1>
            <p className="font-round text-sm text-slate-500">Your friendly AI pal — talk or type!</p>
            <div className="mt-2">
              <TalkingBuddy audioUrl={audio} fallbackText={speakText ?? undefined} color={buddyColor} mood={mood} />
              <div className="mx-auto -mt-2 h-3 w-28 rounded-full bg-slate-900/10 blur-md" />
            </div>
            {status && <p className="mt-3 font-round text-sm font-600 text-slate-500">{status}</p>}

            {/* Customise panel */}
            {customising && (
              <div className="mt-4 rounded-2xl bg-sky-50/70 p-3 text-left ring-1 ring-sky-100">
                <label className="font-fun text-xs font-700 text-slate-500">Buddy&apos;s name</label>
                <div className="mt-1 flex gap-2">
                  <input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    maxLength={20}
                    placeholder="Give your buddy a name"
                    className="min-w-0 flex-1 rounded-full border-2 border-sky/30 bg-white px-4 py-2 font-round text-sm outline-none focus:border-sky-500"
                  />
                  <button
                    onClick={() => saveProfile({ name: nameInput })}
                    className="rounded-full bg-coral px-4 py-2 font-fun text-sm font-700 text-white shadow transition hover:scale-105"
                  >
                    Save
                  </button>
                </div>
                <div className="mt-3 font-fun text-xs font-700 text-slate-500">Colour</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {BUDDY_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => saveProfile({ color: c })}
                      aria-label={`colour ${c}`}
                      className={`h-8 w-8 rounded-full ring-2 transition hover:scale-110 ${buddyColor === c ? "ring-slate-600" : "ring-white"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-100">
            {micSupported && (
              <button
                onClick={recording ? stopRec : startRec}
                disabled={busy || transcribing}
                className={`w-full rounded-full px-8 py-4 font-fun text-lg font-700 text-white shadow-lg transition hover:scale-[1.02] disabled:opacity-60 ${
                  recording ? "bg-coral animate-pulse" : "bg-sky-500"
                }`}
              >
                {recording ? "Stop 🔴" : transcribing ? "Listening… 👂" : "Tap to talk 🎤"}
              </button>
            )}
            {micError && <p className="mt-2 font-round text-sm text-coral">{micError}</p>}

            <form onSubmit={(e) => { e.preventDefault(); ask(text); }} className={`flex items-center gap-2 ${micSupported ? "mt-3" : ""}`}>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={500}
                placeholder={micSupported ? "…or type a message" : "Type a message…"}
                className="min-w-0 flex-1 rounded-full border-2 border-sky/30 bg-sky/5 px-5 py-3 font-round outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                disabled={busy || !text.trim()}
                className="rounded-full bg-coral px-5 py-3 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        </div>

        {/* Right: scrollable chat */}
        <div
          ref={chatRef}
          className="max-h-[70vh] min-h-[16rem] space-y-3 overflow-y-auto rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-slate-100"
        >
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[14rem] items-center justify-center text-center font-round text-slate-400">
              Your chat will show up here 💬
            </div>
          ) : (
            messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <span className="max-w-[85%] rounded-2xl rounded-br-md bg-coral px-4 py-2 font-round text-white shadow-sm">
                    {m.content}
                  </span>
                </div>
              ) : (
                <div key={i} className="flex items-end justify-start gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky/15 text-lg">🤖</span>
                  <span className="max-w-[80%] rounded-2xl rounded-bl-md bg-sky/10 px-4 py-2 font-round text-slate-700 ring-1 ring-sky/20">
                    {m.content}
                  </span>
                  <button
                    onClick={() => speak(m.content)}
                    aria-label="Play again"
                    className="shrink-0 text-slate-300 transition hover:text-sky-500"
                  >
                    🔊
                  </button>
                </div>
              ),
            )
          )}
        </div>
      </div>
    </div>
  );
}
