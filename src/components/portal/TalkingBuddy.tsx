"use client";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export function TalkingBuddy({ audioUrl, fallbackText }: { audioUrl: string | null; fallbackText?: string }) {
  const [mouth, setMouth] = useState(0.1); // 0..1 openness
  const [blink, setBlink] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Pick ONE consistent voice up-front so the buddy doesn't sound different each
  // turn. Voices load asynchronously, so also listen for `voiceschanged`.
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const pick = () => {
      const voices = speechSynthesis.getVoices();
      if (!voices.length) return;
      const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
      // Prefer a friendly named voice, else the default English, else anything English.
      voiceRef.current =
        en.find((v) => /samantha|google us english|aria|jenny|natural/i.test(v.name)) ??
        en.find((v) => v.default) ??
        en[0] ??
        voices[0];
    };
    pick();
    speechSynthesis.addEventListener("voiceschanged", pick);
    return () => speechSynthesis.removeEventListener("voiceschanged", pick);
  }, []);

  useEffect(() => {
    if (audioUrl) {
      // Drive the mouth from real audio amplitude via Web Audio (browser-native).
      const el = new Audio(audioUrl); audioRef.current = el;
      const ctx = new AudioContext();
      const src = ctx.createMediaElementSource(el);
      const analyser = ctx.createAnalyser(); analyser.fftSize = 256;
      src.connect(analyser); analyser.connect(ctx.destination);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      let raf = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        const rms = Math.sqrt(buf.reduce((s, v) => s + (v - 128) ** 2, 0) / buf.length) / 128;
        setMouth(Math.min(1, rms * 4)); raf = requestAnimationFrame(tick);
      };
      el.onplay = () => tick(); el.onended = () => { cancelAnimationFrame(raf); setMouth(0.1); };
      el.play().catch(() => {});
      return () => { cancelAnimationFrame(raf); el.pause(); ctx.close(); };
    } else if (fallbackText && "speechSynthesis" in window) {
      // No server audio → on-device voice + simple mouth flap.
      // Pin the chosen voice + kid-friendly rate/pitch so it stays consistent.
      speechSynthesis.cancel(); // stop any overlapping utterance
      const u = new SpeechSynthesisUtterance(fallbackText);
      if (voiceRef.current) u.voice = voiceRef.current;
      u.rate = 0.95;
      u.pitch = 1.15;
      u.onboundary = () => setMouth((m) => (m > 0.3 ? 0.1 : 0.6));
      u.onend = () => setMouth(0.1);
      speechSynthesis.speak(u);
    }
  }, [audioUrl, fallbackText]);

  // Gentle blink every few seconds.
  useEffect(() => {
    const id = setInterval(() => {
      setBlink(true);
      const t = setTimeout(() => setBlink(false), 140);
      return () => clearTimeout(t);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  const talking = mouth > 0.25;

  return (
    <motion.div
      className="mx-auto w-56"
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    >
      <svg viewBox="0 0 200 210" className="w-full overflow-visible">
        {/* Antennae with glowing tips */}
        <line x1="72" y1="40" x2="64" y2="16" stroke="#a5b4fc" strokeWidth="5" strokeLinecap="round" />
        <motion.circle cx="64" cy="13" r="7" fill="#ffd23f"
          animate={{ scale: talking ? [1, 1.35, 1] : 1 }} transition={{ duration: 0.6, repeat: Infinity }} />
        <line x1="128" y1="40" x2="136" y2="16" stroke="#a5b4fc" strokeWidth="5" strokeLinecap="round" />
        <motion.circle cx="136" cy="13" r="7" fill="#ff6b6b"
          animate={{ scale: talking ? [1, 1.35, 1] : 1 }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} />

        {/* Head */}
        <rect x="24" y="36" width="152" height="150" rx="48" fill="#38bdf8" />
        <rect x="24" y="36" width="152" height="72" rx="40" fill="#fff" opacity="0.12" />
        {/* Side bolts / ears */}
        <circle cx="22" cy="112" r="10" fill="#7dd3fc" />
        <circle cx="178" cy="112" r="10" fill="#7dd3fc" />

        {/* Eyes — white base squashes shut on blink */}
        <motion.ellipse cx="76" cy="100" rx="22" fill="#fff" animate={{ ry: blink ? 3 : 24 }} transition={{ duration: 0.08 }} />
        <motion.ellipse cx="124" cy="100" rx="22" fill="#fff" animate={{ ry: blink ? 3 : 24 }} transition={{ duration: 0.08 }} />
        {/* Pupils + catchlights, hidden during the blink */}
        <motion.g animate={{ opacity: blink ? 0 : 1 }} transition={{ duration: 0.05 }}>
          <circle cx="80" cy="102" r="10" fill="#1e293b" />
          <circle cx="120" cy="102" r="10" fill="#1e293b" />
          <circle cx="84" cy="98" r="3.5" fill="#fff" />
          <circle cx="124" cy="98" r="3.5" fill="#fff" />
        </motion.g>

        {/* Rosy cheeks */}
        <circle cx="58" cy="138" r="12" fill="#ff6b6b" opacity="0.35" />
        <circle cx="142" cy="138" r="12" fill="#ff6b6b" opacity="0.35" />

        {/* Friendly mouth — a soft warm pill that opens when talking (drawn first = the cavity) */}
        <motion.rect x="80" width="40" rx="14" fill="#8b3a52"
          animate={{ y: 140 - mouth * 9, height: 10 + mouth * 34 }} transition={{ duration: 0.06 }} />
        {/* Little tongue sits in front, peeking out when the mouth is open */}
        <motion.ellipse cx="100" rx="10" fill="#ff8fab"
          animate={{ cy: 150 + mouth * 14, ry: 3 + mouth * 6, opacity: mouth > 0.3 ? 1 : 0 }} transition={{ duration: 0.06 }} />
      </svg>
    </motion.div>
  );
}
