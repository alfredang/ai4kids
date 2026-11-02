"use client";
import { useEffect, useState } from "react";

export function MarketingMotion() {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    setPaused(motion.matches);
    return () =>
      document.documentElement.classList.remove("kids-motion-paused");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("kids-motion-paused", paused);
    document.dispatchEvent(new Event("kids-motion-change"));
  }, [paused]);
  useEffect(() => {
    const nodes = document.querySelectorAll(
      ".kids-marketing .kids-album-card, .kids-marketing .kids-pack-cover, .kids-marketing .kids-toybox-art",
    );
    if (!nodes.length || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.remove("kids-reveal-pending");
            entry.target.classList.add("kids-revealed");
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.08 },
    );
    for (const node of nodes) {
      if (node.getBoundingClientRect().top > innerHeight)
        node.classList.add("kids-reveal-pending");
      observer.observe(node);
    }
    return () => {
      observer.disconnect();
      nodes.forEach((n) => n.classList.remove("kids-reveal-pending"));
    };
  }, []);
  return (
    <button
      type="button"
      className="kids-motion-toggle"
      onClick={() => setPaused(!paused)}
      aria-pressed={paused}
    >
      <span aria-hidden="true">{paused ? "✨" : "⏸"}</span>
      {paused ? "Play the wiggles" : "Pause the wiggles"}
    </button>
  );
}
