"use client";
import { KidsIcon } from "@/components/public/KidsIcon";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";


const SLIDES = [
  {
    image: "/images/family-ai-banner.webp",
    label: "Learn AI together",
    alt: "Singaporean parents and children discovering AI together in a sunny Singapore learning studio",
  },
  {
    image: "/images/story-workshop-banner.webp",
    label: "Create an AI storybook",
    alt: "Singapore mother and daughter writing a Merlion story with a facilitator, an AI storybook on their laptop and their own drawings",
  },
  {
    image: "/images/maths-workshop-banner.webp",
    label: "Solve a maths mystery",
    alt: "Singapore father and son learning maths with an instructor, AI hints and bar models on a laptop and their own maths working",
  },
];

export function FamilyBanner() {
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [globalPaused, setGlobalPaused] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [readyImages, setReadyImages] = useState<Set<number>>(() => new Set());
  const wrapper = useRef<HTMLElement>(null);
  const animating = !paused && !reduced && !globalPaused;
  useEffect(() => {
    const sync = () =>
      setGlobalPaused(
        document.documentElement.classList.contains("kids-motion-paused"),
      );
    sync();
    document.addEventListener("kids-motion-change", sync);
    return () => document.removeEventListener("kids-motion-change", sync);
  }, []);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!wrapper.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(wrapper.current);
    const change = () =>
      setVisible(
        document.visibilityState === "visible" &&
          !!wrapper.current &&
          wrapper.current.getBoundingClientRect().bottom > 0,
      );
    document.addEventListener("visibilitychange", change);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", change);
    };
  }, []);
  function show(next: number) {
    if (next === index || transitioning || !readyImages.has(next)) return;
    setPrevious(index);
    setIndex(next);
    setTransitioning(true);
  }
  useEffect(() => {
    if (!transitioning) return;
    const timeout = setTimeout(
      () => setTransitioning(false),
      reduced ? 50 : 1550,
    );
    return () => clearTimeout(timeout);
  }, [transitioning, reduced]);
  useEffect(() => {
    if (!animating || hovered || focused || !visible || transitioning) return;
    const timer = setInterval(() => {
      const next = (index + 1) % SLIDES.length;
      if (readyImages.has(next)) {
        setPrevious(index);
        setIndex(next);
        setTransitioning(true);
      }
    }, 6500);
    return () => clearInterval(timer);
  }, [animating, hovered, focused, visible, transitioning, index, readyImages]);
  return (
    <section
      ref={wrapper}
      className={`kids-family-banner ${animating ? "banner-playing" : "banner-paused"}`}
      aria-roledescription="carousel"
      aria-label="December parent and child AI workshop photos"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <div
        className={`kids-banner-photos ${transitioning ? "is-tiles-changing" : ""}`}
      >
        {SLIDES.map((slide, i) => (
          <div
            key={slide.image}
            className={`kids-banner-slide ${i === index ? "is-current" : ""} ${i === previous ? "is-previous" : ""} ${i === index && transitioning ? "tiles-reveal" : ""}`}
            aria-hidden={i !== index}
          >
            <Image
              src={slide.image}
              alt={slide.alt}
              width={3840}
              height={2160}
              priority={i === 0}
              loading={i === 0 ? undefined : "eager"}
              quality={90}
              sizes="(max-width: 768px) 100vw, 1280px"
              className="kids-family-photo"
              onLoad={() =>
                setReadyImages((previous) => new Set(previous).add(i))
              }
            />
          </div>
        ))}
        {transitioning && !reduced && <div className="kids-tetris-grid" key={`${previous}-${index}`} aria-hidden="true">
          {Array.from({length:24},(_,tile)=>{
            const col=tile%6, row=Math.floor(tile/6);
            return <div key={tile} className="kids-tetris-tile" style={{left:`${col*100/6}%`,top:`${row*25}%`,animationDelay:`${[0,3,1,5,2,4][col]*65+(3-row)*70}ms`}}>
              <Image src={SLIDES[index].image} alt="" width={3840} height={2160} quality={90} sizes="(max-width:768px)100vw,1280px" className="kids-tetris-photo" style={{left:`${-col*100}%`,top:`${-row*100}%`}} />
            </div>;
          })}
        </div>}
      </div>
      <div className="kids-banner-controls">
        <span className="kids-banner-caption">
          {SLIDES[index].label} <span aria-hidden="true">♡</span>
        </span>
        <div className="kids-banner-buttons">
          <button
            type="button"
            aria-label="Previous workshop photo"
            disabled={
              transitioning ||
              !readyImages.has((index + SLIDES.length - 1) % SLIDES.length)
            }
            onClick={() => show((index + SLIDES.length - 1) % SLIDES.length)}
          >
            <KidsIcon name="left" />
          </button>
          <span
            className="kids-banner-count"
            aria-live={paused || focused ? "polite" : "off"}
          >
            {index + 1} / {SLIDES.length}
          </span>
          <button
            type="button"
            aria-label="Next workshop photo"
            disabled={
              transitioning || !readyImages.has((index + 1) % SLIDES.length)
            }
            onClick={() => show((index + 1) % SLIDES.length)}
          >
            <KidsIcon name="right" />
          </button>
          <button
            type="button"
            aria-label={
              paused ? "Play banner slideshow" : "Pause banner slideshow"
            }
            onClick={() => {
              if (paused) {
                setPaused(false);
                setHovered(false);
                setFocused(false);
              } else {
                setPaused(true);
              }
            }}
          >
            {paused ? <KidsIcon name="play" /> : <KidsIcon name="pause" />}
          </button>
        </div>
      </div>
    </section>
  );
}
