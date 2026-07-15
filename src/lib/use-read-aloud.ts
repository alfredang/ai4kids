"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { stripForSpeech } from "@/lib/strip-emoji";

/**
 * Read-aloud for young/emerging readers. Speaks a line via the shared kid TTS
 * route (warm `luna` Aura voice), falling back to the on-device browser voice if
 * the server returns no audio. Only one line plays at a time per hook instance.
 *
 * Narration takes ~1-2s to generate, so results are cached by text and in-flight
 * requests are deduped — `prefetch` a line while the child reads the previous one
 * and playback is instant on arrival.
 */
export function useReadAloud() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cache = useRef<Map<string, string | null>>(new Map()); // text → audio data-URL (null = use browser voice)
  const inflight = useRef<Map<string, Promise<string | null>>>(new Map());
  const seq = useRef(0); // guards against audio arriving after the reader moved on
  const [speaking, setSpeaking] = useState(false);

  const stop = useCallback(() => {
    seq.current++;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  /** Fetch (or reuse) the narration for one line. Deduped + cached. */
  const load = useCallback((text: string): Promise<string | null> => {
    const clean = stripForSpeech(text);
    if (!clean) return Promise.resolve(null);
    const hit = cache.current.get(clean);
    if (hit !== undefined) return Promise.resolve(hit);
    const pending = inflight.current.get(clean);
    if (pending) return pending;
    const p = fetch("/api/learn/buddy/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean }),
    })
      .then((r) => r.json())
      .then((d) => (d?.audio as string | null) ?? null)
      .catch(() => null)
      .then((url) => {
        cache.current.set(clean, url);
        inflight.current.delete(clean);
        return url;
      });
    inflight.current.set(clean, p);
    return p;
  }, []);

  const prefetch = useCallback(
    (text: string | undefined) => {
      if (text) void load(text);
    },
    [load],
  );

  const speak = useCallback(
    async (text: string) => {
      stop();
      const clean = stripForSpeech(text);
      if (!clean) return;
      const mine = ++seq.current;
      setSpeaking(true);
      const url = await load(text);
      if (mine !== seq.current) return; // superseded by a newer line / stop()
      if (url) {
        const el = new Audio(url);
        audioRef.current = el;
        el.onended = () => setSpeaking(false);
        await el.play().catch(() => setSpeaking(false));
        return;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(clean);
        u.rate = 0.95;
        u.pitch = 1.15;
        u.onend = () => setSpeaking(false);
        window.speechSynthesis.speak(u);
      } else {
        setSpeaking(false);
      }
    },
    [load, stop],
  );

  useEffect(() => stop, [stop]); // stop any narration when the reader unmounts
  return { speak, prefetch, stop, speaking };
}
