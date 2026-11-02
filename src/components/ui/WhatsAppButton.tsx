"use client";
import { KidsIcon } from "@/components/public/KidsIcon";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";


import { PipMascot } from "@/components/public/PipMascot";
import {
  HOLIDAY_WORKSHOPS,
  workshopWhatsAppUrl,
} from "@/lib/holiday-workshops";

type Message = {
  who: "pip" | "you";
  text: string;
  href?: string;
  link?: string;
};
const GREETING: Message = {
  who: "pip",
  text: "Hiii, I’m Pip! A little helper for your next big family adventure. What would your little one love to try?",
};

export function WhatsAppButton({ number }: { number: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [overFooter, setOverFooter] = useState(false);
  const [peek, setPeek] = useState(false);
  const [invitation, setInvitation] = useState(0);
  const invitations = ["Looking for a December workshop?", "Story magic or maths mysteries?", "A little parent + child adventure?", "Need help choosing a workshop?"];

  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const disabled = path?.startsWith("/admin") || path?.startsWith("/learn");
  useEffect(() => {
    if (open || disabled || overFooter) { setPeek(false); return; }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let hide: ReturnType<typeof setTimeout> | undefined;
    const show = () => {
      if (document.hidden || reduced.matches || document.documentElement.classList.contains("kids-motion-paused") || document.activeElement?.closest("form")) return;
      setInvitation(current => (current + 1) % 4);
      setPeek(true);
      hide = setTimeout(() => setPeek(false), 6500);
    };
    const first = setTimeout(show, 4500);
    const repeat = setInterval(show, 21000);
    return () => { clearTimeout(first); clearInterval(repeat); if (hide) clearTimeout(hide); };
  }, [open, disabled, overFooter, path]);
  useEffect(() => {
    const footer = document.querySelector(".kids-site-footer");
    if (!footer) return;
    const observer = new IntersectionObserver(([entry]) =>
      setOverFooter(entry.isIntersecting),
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, [path]);
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);
  function close() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  function ask(question: string) {
    const text = question.trim().slice(0, 500);
    if (!text) return;
    const lower = text.toLowerCase();
    let response: Message;
    const workshop = /math|sum|number/.test(lower)
      ? HOLIDAY_WORKSHOPS[2]
      : /scien|plant|leaf/.test(lower)
        ? HOLIDAY_WORKSHOPS[3]
        : /art|draw|content|comic/.test(lower)
          ? HOLIDAY_WORKSHOPS[1]
          : /stor|writ|book/.test(lower)
            ? HOLIDAY_WORKSHOPS[0]
            : null;
    if (workshop)
      response = {
        who: "pip",
        text: `${workshop.title.replace(/[!.?]$/, "")}! Suggested ages ${workshop.ageMin}–${workshop.ageMax}. Your child will make ${workshop.takeaway.toLowerCase()} with grown-up guidance. Let’s ask the team about December dates and fees!`,
        href: `/holiday-workshops/${workshop.slug}`,
        link: "Peek inside this workshop →",
      };
    else if (/free|tool|pack/.test(lower))
      response = {
        who: "pip",
        text: "A little freebie for your family! Try our story, maths and science activities together. No paid subscription needed. A grown-up operates age-restricted tools.",
        href: "/downloads/family-ai-starter-pack.html",
        link: "Open your free family activity pack →",
      };
    else if (/age|old|year/.test(lower))
      response = {
        who: "pip",
        text: "Our holiday ideas are aimed at ages 7–12: stories and art from 7, maths and science from 8. Younger or older? Our team can help you check suitability. Share an age group with a grown-up’s help—no child’s full name needed!",
      };
    else if (/date|dec|fee|price|cost|where|book|time/.test(lower))
      response = {
        who: "pip",
        text: "December adventures are a lovely idea! Our team will confirm dates, fees, session length and location before you book. Tap WhatsApp below to ask about your family’s plans.",
        href: "/#enquire",
        link: "Or send a December workshop enquiry →",
      };
    else
      response = {
        who: "pip",
        text: "That sounds like a question for our lovely team! I can help you explore stories, art, maths or science here. For a personal answer, take your question over to WhatsApp using the button below. 🌼",
      };
    setMessages((previous) => [
      ...previous.slice(-18),
      { who: "you", text },
      response,
    ]);
    setLastQuestion(text);
    setInput("");
  }
  if (disabled) return null;
  const handoff = lastQuestion
    ? `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi! I'm enquiring about December 2026 AI Kids family workshops. My question: ${lastQuestion}`)}`
    : workshopWhatsAppUrl(number);
  return (
    <aside
      className={`pip-widget ${overFooter ? "pip-over-footer" : ""}`}
      aria-label="Family workshop helper"
    >
      {open && (
        <section
          className="pip-chat"
          id="pip-chat-panel"
          aria-label="Chat with Pip, family workshop helper"
        >
          <div className="pip-chat-roof" aria-hidden="true">
            <span>✧</span>
            <span>little questions. big possibilities.</span>
            <span>✧</span>
          </div>
          <header className="pip-chat-header">
            <div className="pip-avatar">
              <PipMascot />
            </div>
            <div>
              <h2>
                Hi, I’m Pip! <span aria-hidden="true">♡</span>
              </h2>
              <p>Your sunny little workshop helper</p>
            </div>
            <button ref={closeRef} onClick={close} aria-label="Close Pip chat">
              <KidsIcon name="close" />
            </button>
          </header>
          <div
            className="pip-chat-log"
            role="log"
            aria-live="polite"
            aria-label="Conversation with Pip"
            ref={logRef}
          >
            {messages.map((message, i) => (
              <div key={i} className={`pip-message pip-message-${message.who}`}>
                {message.who === "pip" && (
                  <span className="pip-message-name">
                    PIP <span aria-hidden="true">✿</span>
                  </span>
                )}
                <p>{message.text}</p>
                {message.href && (
                  <Link href={message.href} onClick={close}>
                    {message.link}
                  </Link>
                )}
              </div>
            ))}
          </div>
          <div className="pip-quick-questions" aria-label="Suggested questions">
            {[
              "Story magic",
              "Maths mysteries",
              "Art adventures",
              "Science fun",
              "December details",
              "Free activity pack",
            ].map((q) => (
              <button key={q} onClick={() => ask(q)}>
                {q}
              </button>
            ))}
          </div>
          <form
            className="pip-input-form"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <label className="sr-only" htmlFor="pip-question">
              Your workshop question
            </label>
            <input
              id="pip-question"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a little question…"
              maxLength={500}
            />
            <button
              disabled={!input.trim()}
              type="submit"
              aria-label="Send question to Pip"
            >
              <KidsIcon name="send" />
            </button>
          </form>
          <div className="pip-handoff">
            <a href={handoff} target="_blank" rel="noopener noreferrer">
              <KidsIcon name="chat" aria-hidden="true" /> Chat with our team on WhatsApp{" "}
              <span aria-hidden="true">↗</span>
            </a>
            <small>
              Quick answers here · Personal help on WhatsApp
              <br />
              Please keep children’s personal details private.
            </small>
          </div>
        </section>
      )}
      <button
        ref={triggerRef}
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={
          open
            ? "Close Pip workshop helper"
            : "Open Pip, your cute family workshop helper"
        }
        aria-expanded={open}
        aria-controls="pip-chat-panel"
        className={`pip-launcher ${open ? "pip-is-open" : ""} ${peek ? "pip-is-peeking" : ""}`}
      >
        <span className="pip-launcher-bubble" aria-hidden="true">
          {open ? (
            "Sending you sunshine!"
          ) : (
            <>
              {invitations[invitation]}
              <small>
                Ask Pip! <span aria-hidden="true">♡</span>
              </small>
            </>
          )}
        </span>
        <span className="pip-launcher-character">
          <PipMascot />
          <span className="pip-whatsapp-dot">
            <KidsIcon name="chat" />
          </span>
        </span>
        <span className="pip-launcher-spark" aria-hidden="true">
          ✦
        </span>
      </button>
    </aside>
  );
}
