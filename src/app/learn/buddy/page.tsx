"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { TalkingBuddy } from "@/components/portal/TalkingBuddy";

type Turn = { role: "user" | "buddy"; content: string };

export default function BuddyPage() {
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Turn[]>([]);
  const [audio, setAudio] = useState<string | null>(null);
  const [micSupported, setMicSupported] = useState(false);

  // Detect mic support after mount to avoid a hydration mismatch.
  useEffect(() => {
    setMicSupported(!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  }, []);

  async function ask(message: string) {
    const m = message.trim();
    if (!m || busy) return;
    setBusy(true);
    setText("");
    const history = messages; // prior turns (before this one)
    setMessages((prev) => [...prev, { role: "user", content: m }]);
    try {
      const res = await fetch("/api/learn/buddy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: m, history }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "buddy", content: data.reply ?? "Hmm, let's try that again!" }]);
      setAudio(data.audio ?? null);
    } catch {
      setMessages((prev) => [...prev, { role: "buddy", content: "Oops, my ears aren't working right now — try again in a moment!" }]);
      setAudio(null);
    } finally {
      setBusy(false);
    }
  }

  function talk() {
    const Rec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Rec) return; // no mic support — the text box below is always available
    const rec = new Rec();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onresult = (e: any) => ask(e.results[0][0].transcript);
    rec.start();
  }

  function clearChat() {
    setMessages([]);
    setAudio(null);
    if (typeof window !== "undefined" && "speechSynthesis" in window) speechSynthesis.cancel();
  }

  // The most recent buddy line drives the avatar's voice/lip-sync.
  const lastBuddy = [...messages].reverse().find((m) => m.role === "buddy")?.content;

  return (
    <div className="mx-auto max-w-md text-center">
      <div className="flex items-center justify-between">
        <Link href="/learn" className="font-fun text-sm font-600 text-slate-400 hover:text-coral">← Back to activities</Link>
        {messages.length > 0 && (
          <button onClick={clearChat} className="font-fun text-sm font-600 text-slate-400 hover:text-coral">
            New chat 🧹
          </button>
        )}
      </div>
      <h1 className="mt-3 font-fun text-3xl font-700 text-slate-900">🤖 Talking Buddy</h1>

      <TalkingBuddy audioUrl={audio} fallbackText={audio ? undefined : lastBuddy} />

      {/* Conversation transcript */}
      {messages.length > 0 && (
        <div className="mt-4 space-y-2 text-left">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <span
                className={`inline-block max-w-[80%] rounded-2xl px-4 py-2 font-round ${
                  m.role === "user" ? "bg-coral text-white" : "bg-sky/15 text-slate-700"
                }`}
              >
                {m.content}
              </span>
            </div>
          ))}
        </div>
      )}
      {busy && <p className="mt-2 font-round text-slate-400">Thinking… 💭</p>}

      {/* Type to your buddy */}
      <form onSubmit={(e) => { e.preventDefault(); ask(text); }} className="mt-5 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          placeholder="Type a message…"
          className="min-w-0 flex-1 rounded-full border-2 border-sky/40 bg-white px-5 py-3 font-round text-lg outline-none focus:border-sky-500"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="rounded-full bg-coral px-5 py-3 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
        >
          Send
        </button>
      </form>

      {/* Or talk out loud (when the browser supports it) */}
      {micSupported && (
        <button
          onClick={talk}
          disabled={listening || busy}
          className="mt-3 rounded-full bg-sky-500 px-8 py-3 font-fun text-lg font-700 text-white shadow-lg transition hover:scale-105 disabled:opacity-60"
        >
          {listening ? "Listening… 🎤" : "Tap to talk 🎤"}
        </button>
      )}
    </div>
  );
}
