"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TalkingBuddy } from "@/components/portal/TalkingBuddy";

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

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);

  // Detect mic support after mount to avoid a hydration mismatch.
  useEffect(() => {
    setMicSupported(typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  // Keep the chat scrolled to the newest message.
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function ask(message: string) {
    const m = message.trim();
    if (!m || busy) return;
    setBusy(true);
    setText("");
    setAudio(null);
    setSpeakText(null);
    const history = messages; // prior turns (before this one)
    setMessages((prev) => [...prev, { role: "user", content: m }]);

    // 1. Get the reply text (fast) and show it immediately.
    let reply = "Oops, my ears aren't working right now — try again in a moment!";
    try {
      const res = await fetch("/api/learn/buddy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: m, history }),
      });
      const data = await res.json();
      reply = data.reply ?? "Hmm, let's try that again!";
    } catch { /* keep the fallback line */ }
    setMessages((prev) => [...prev, { role: "buddy", content: reply }]);
    setBusy(false); // text is in — re-enable input right away

    // 2. Fetch the spoken audio separately; buddy speaks when it arrives.
    try {
      const sres = await fetch("/api/learn/buddy/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply }),
      });
      const sdata = await sres.json();
      if (sdata.audio) setAudio(sdata.audio);
      else setSpeakText(reply); // server TTS unavailable → browser voice
    } catch {
      setSpeakText(reply);
    }
  }

  // Tap-to-talk: record mic audio, then transcribe via Cloudflare Whisper.
  async function startRec() {
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
    } catch {
      setRecording(false); // mic permission denied — the text box still works
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
    setMessages([]);
    setAudio(null);
    setSpeakText(null);
    if (typeof window !== "undefined" && "speechSynthesis" in window) speechSynthesis.cancel();
  }

  const status = busy
    ? "Thinking… 💭"
    : transcribing
      ? "Listening… 👂"
      : recording
        ? "I'm listening — tap Stop when you're done! 🎤"
        : messages.length === 0
          ? "Tap the mic and say hi, or type below! 👋"
          : "";

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
          <div className="rounded-[2rem] bg-gradient-to-b from-sky-100 to-white p-6 text-center shadow-sm ring-1 ring-sky-100">
            <h1 className="font-fun text-2xl font-700 text-slate-900">🤖 Talking Buddy</h1>
            <p className="font-round text-sm text-slate-500">Your friendly AI pal — talk or type!</p>
            <div className="mt-2">
              <TalkingBuddy audioUrl={audio} fallbackText={speakText ?? undefined} />
              {/* soft platform so the buddy feels grounded, not floating */}
              <div className="mx-auto -mt-2 h-3 w-28 rounded-full bg-slate-900/10 blur-md" />
            </div>
            {status && <p className="mt-3 font-round text-sm font-600 text-slate-500">{status}</p>}
          </div>

          {/* Controls */}
          <div className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-100">
            {/* Talk out loud — record → Whisper transcription (works in all browsers) */}
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
                  <span className="max-w-[85%] rounded-2xl rounded-bl-md bg-sky/10 px-4 py-2 font-round text-slate-700 ring-1 ring-sky/20">
                    {m.content}
                  </span>
                </div>
              ),
            )
          )}
        </div>
      </div>
    </div>
  );
}
