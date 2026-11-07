"use client";
import { KidsIcon } from "@/components/public/KidsIcon";

import Link from "next/link";
import { useRef, useState } from "react";


import {
  HOLIDAY_WORKSHOPS,
  workshopWhatsAppUrl,
} from "@/lib/holiday-workshops";
import { TurnstileWidget } from "@/components/forms/TurnstileWidget";
import { WorkshopSticker } from "@/components/public/WorkshopSticker";
import { WorkshopArt } from "@/components/public/WorkshopArt";

export function WorkshopAlbum() {
  const [filter, setFilter] = useState("All adventures");
  const filters = [
    "All adventures",
    "Storytelling",
    "Art & creativity",
    "Maths",
    "Science",
  ];
  const workshops = HOLIDAY_WORKSHOPS.filter(
    (w) => filter === "All adventures" || w.subject === filter,
  );
  return (
    <>
      <div
        className="kids-album-filters"
        aria-label="Filter workshops by interest"
      >
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={filter === f ? "is-active" : ""}
          >
            {f}
          </button>
        ))}
      </div>
      <p className="sr-only" role="status">
        {workshops.length} workshops shown
      </p>
      <div className="kids-album-grid">
        {workshops.map((w) => (
          <article className={`kids-album-card kids-${w.theme}`} key={w.slug}>
            <span className="kids-tape" aria-hidden="true" />
            <Link
              href={`/holiday-workshops/${w.slug}`}
              className="kids-album-art"
              tabIndex={-1}
              aria-hidden="true"
            >
              <span className="kids-cover-doodle doodle-one">✧</span>
              <span className="kids-cover-doodle doodle-two">✦</span>
              <WorkshopSticker subject={w.subject} />
              <span className="kids-cover-caption">
                {w.subject === "Storytelling"
                  ? "once upon an AI…"
                  : w.subject === "Maths"
                    ? "big clues. little geniuses."
                    : w.subject === "Science"
                      ? "a little more curious"
                      : "made of imagination"}
              </span>
            </Link>
            <div className="kids-album-info">
              <div className="kids-card-meta">
                <span>{w.subject}</span>
                <span>
                  Ages {w.ageMin}–{w.ageMax}
                </span>
              </div>
              <h3>
                <Link href={`/holiday-workshops/${w.slug}`}>{w.title}</Link>
              </h3>
              <p>{w.summary}</p>
              <div className="kids-takeaway">
                <KidsIcon name="check" aria-hidden="true" />
                <span>{w.takeaway}</span>
              </div>
              <Link
                className="kids-card-link"
                href={`/holiday-workshops/${w.slug}`}
              >
                Explore this workshop <KidsIcon name="arrow" aria-hidden="true" />
              </Link>
            </div>
          </article>
        ))}
      </div>
      <p className="kids-album-note">
        <strong>December dates &amp; fees?</strong> <a href="#enquire">Get the details! →</a>
      </p>
    </>
  );
}

export function TryTogether() {
  const [tab, setTab] = useState<"story" | "maths">("story");
  const [revealed, setRevealed] = useState(false);
  const [hero, setHero] = useState("a tiny Merlion");
  function changeTab(next: "story" | "maths") {
    setTab(next);
    setRevealed(false);
  }
  return (
    <div className="kids-demo">
      <div
        className="kids-demo-tabs"
        role="tablist"
        aria-label="Choose a family activity"
      >
        <button
          id="story-tab"
          role="tab"
          aria-selected={tab === "story"}
          aria-controls="family-demo-panel"
          onClick={() => changeTab("story")}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              changeTab("maths");
              document.getElementById("maths-tab")?.focus();
            }
          }}
          tabIndex={tab === "story" ? 0 : -1}
        >
          <KidsIcon name="book" /> Make a story
        </button>
        <button
          id="maths-tab"
          role="tab"
          aria-selected={tab === "maths"}
          aria-controls="family-demo-panel"
          onClick={() => changeTab("maths")}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              changeTab("story");
              document.getElementById("story-tab")?.focus();
            }
          }}
          tabIndex={tab === "maths" ? 0 : -1}
        >
          <KidsIcon name="maths" /> Solve a maths mystery
        </button>
      </div>
      <div
        id="family-demo-panel"
        role="tabpanel"
        aria-labelledby={tab === "story" ? "story-tab" : "maths-tab"}
        className="kids-demo-content"
      >
        <span className="kids-eyebrow">YOUR IDEAS + A LITTLE AI</span>
        {tab === "story" ? (
          <>
            <h3>Let’s make a story!</h3>
            <label htmlFor="story-hero">Our story’s hero is…</label>
            <select
              id="story-hero"
              value={hero}
              onChange={(e) => {
                setHero(e.target.value);
                setRevealed(false);
              }}
            >
              <option>a tiny Merlion</option>
              <option>a brave little otter</option>
              <option>a curious robot</option>
            </select>
            <p className="kids-demo-prompt">
              “Help us imagine a story about {hero} who finds a rainbow in a
              kaya toast shop. Give us three possible adventures!”
            </p>
            <button
              className="kids-button"
              onClick={() => setRevealed(!revealed)}
              aria-expanded={revealed}
              aria-controls="demo-result"
            >
              <KidsIcon name="sparkles" aria-hidden="true" />
              {revealed ? "Hide our story spark" : "Show a story spark"}
            </button>
            {revealed && (
              <div id="demo-result" className="kids-demo-result" role="status">
                <strong>One spark, a whole world of possibilities…</strong>
                <p>
                  One sunny morning, {hero} spotted a rainbow peeking out of a
                  jar of kaya. It gave a tiny sneeze. “Achoo! Can you help me
                  get home?”
                </p>
                <p>
                  <b>Your child’s turn:</b> Where does the rainbow live? Draw
                  its home, then tell a grown-up what happens next.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <h3>Let’s solve a mystery!</h3>
            <p className="kids-demo-prompt">
              At the hawker centre, Mei buys 3 bowls of noodles for S$4 each and
              pays with S$20. How much change should she get?
            </p>
            <p>
              Our AI prompt: “Give us one helpful hint. Don’t tell us the answer
              yet.”
            </p>
            <button
              className="kids-button"
              onClick={() => setRevealed(!revealed)}
              aria-expanded={revealed}
              aria-controls="demo-result"
            >
              <KidsIcon name="sparkles" aria-hidden="true" />
              {revealed ? "Hide our maths clue" : "Reveal a helpful clue"}
            </button>
            {revealed && (
              <div id="demo-result" className="kids-demo-result" role="status">
                <strong>First clue: draw three bowls.</strong>
                <p>
                  Write S$4 under each bowl. What is the total cost? Now
                  subtract that from S$20.
                </p>
                <details>
                  <summary>Ready to check your reasoning?</summary>
                  <p>
                    3 × S$4 = S$12. S$20 − S$12 = <b>S$8 change</b>. Check: S$12
                    + S$8 = S$20. You solved it!
                  </p>
                </details>
              </div>
            )}
          </>
        )}
        <p className="kids-demo-footnote">
          A prepared workshop example, not a live AI chat. During activities, an
          adult operates age-restricted tools and checks the output with the
          child.
        </p>
      </div>
    </div>
  );
}

type FormState = "idle" | "sending" | "success" | "error";
export function HolidayEnquiryForm({
  number,
  initialWorkshop = "",
  source = "december-holiday-workshop",
}: {
  number: string;
  initialWorkshop?: string;
  /** Lead source, so /admin/leads shows which page produced the enquiry. */
  source?: string;
}) {
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "sending") return;
    const data = new FormData(e.currentTarget);
    setState("sending");
    setError("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          phone: data.get("phone"),
          company: "Singapore parent / family",
          message: `December 2026 holiday workshop enquiry\nWorkshop: ${data.get("workshop")}\nChild age band: ${data.get("age")}\n${data.get("message") || "Please share dates, fees and the parent-child format."}\nParent or guardian confirmed consent to contact about this enquiry.`,
          source,
          turnstileToken: token,
        }),
      });
      if (!response.ok)
        throw new Error(
          "We couldn’t save your enquiry just yet. Please try again, or say hello on WhatsApp.",
        );
      setState("success");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Please try again.");
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }
  if (state === "success")
    return (
      <div className="kids-enquiry-form kids-form-success" role="status">
        <KidsIcon name="sun" />
        <h3>A little adventure is on its way!</h3>
        <p>
          Your enquiry has been saved. Our team will contact you about suitable
          December workshops, dates and fees.
        </p>
        <p>Want to chat now?</p>
        <a
          className="kids-button"
          href={workshopWhatsAppUrl(number)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <KidsIcon name="chat" aria-hidden="true" /> Say hello on WhatsApp
        </a>
      </div>
    );
  return (
    <form className="kids-enquiry-form" onSubmit={submit}>
      <div className="kids-form-hello"><KidsIcon name="mail" /><div><h3>Let’s plan a little adventure!</h3><p>A quick hello. <strong>No payment, no pressure.</strong></p></div></div>
      <div className="kids-form-grid">
        <label>
          Hi! You can call me…
          <input
            name="name"
            autoComplete="name"
            required
            maxLength={255}
            placeholder="What should we call you?"
          />
        </label>
        <label>
          Send our adventure ideas here…
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={255}
            placeholder="you@example.com"
          />
        </label>
        <label>
          My little explorer is…
          <select name="age" required defaultValue="">
            <option value="" disabled>
              Choose an age group
            </option>
            <option>4–6 (ask about suitability)</option>
            <option>7–9 years</option>
            <option>10–12 years</option>
            <option>13–16 (ask about suitability)</option>
          </select>
        </label>
        <label>
          Phone / WhatsApp <span>(optional)</span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={50}
            placeholder="+65"
          />
        </label>
        <label className="kids-form-full">
          They’d love to try…
          <select
            name="workshop"
            defaultValue={initialWorkshop || "Help us choose"}
            required
          >
            <option value="Help us choose">Help us choose!</option>
            {HOLIDAY_WORKSHOPS.map((w) => (
              <option key={w.slug} value={w.shortTitle}>
                {w.shortTitle}
              </option>
            ))}
            <option>A mix of adventures / not sure yet</option>
          </select>
        </label>
        <label className="kids-form-full">
          A little note for us? <span>(optional)</span>
          <textarea
            name="message"
            rows={2}
            maxLength={2000}
            placeholder="Favourite things, December dates, or a little question…"
          />
        </label>
      </div>
      <label className="kids-consent">
        <input type="checkbox" required />
        <span>
          I’m a parent or guardian and agree to be contacted about this enquiry
          under the <Link href="/privacy">privacy policy</Link>.
        </span>
      </label>
      <TurnstileWidget onToken={setToken} />
      {error && (
        <p
          className="kids-form-error"
          role="alert"
          tabIndex={-1}
          ref={errorRef}
        >
          {error}
        </p>
      )}
      <button
        className="kids-button kids-form-submit"
        type="submit"
        disabled={state === "sending"}
      >
        {state === "sending" ? "Sending your hello…" : "Help us pick an adventure!"}
        <KidsIcon name="arrow" aria-hidden="true" />
      </button>
      <small>We’ll reply with suitable workshops, dates and fees.</small>
    </form>
  );
}

export function StarterPack({ number }: { number: string }) {
  const [state, setState] = useState<FormState>("idle");
  const [token, setToken] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setState("sending");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Parent — Family AI Starter Pack",
          email: data.get("email"),
          company: "Singapore parent / family",
          message:
            "I requested the free Family AI Starter Pack and would like to hear about December 2026 parent-child workshops. I confirm I am a parent or guardian and consent to contact about this request.",
          source: "family-ai-starter-pack",
          turnstileToken: token,
        }),
      });
      if (!response.ok) throw new Error("Unable to save");
      setState("success");
    } catch {
      setState("error");
    }
  }
  return (
    <div className="kids-starter-section" id="free-pack">
      <div className="kids-pack-cover" aria-hidden="true">
        <span className="kids-tape" />
        <small>A LITTLE SOMETHING FOR YOUR FAMILY</small>
        <span>
          My first
          <br />
          AI adventure
        </span>
        <b>create · discover · giggle</b>
        <div className="kids-pack-friends"><KidsIcon name="book" /><KidsIcon name="maths" /><KidsIcon name="science" /></div>
        <em>THE FAMILY STARTER PACK</em>
      </div>
      <div className="kids-pack-copy">
        <span className="kids-eyebrow">FREE FAMILY GOODIES</span>
        <h2>
          Your little box of <span>big ideas!</span>
        </h2>
        <p>Three free activities. One curious child. And you!</p>
        <ul className="kids-check-list">
          <li>Story, maths and science prompts</li>
          <li>20 minutes of family fun per activity</li>
          <li>Print it. Try it. Keep it!</li>
        </ul>
        <a
          className="kids-button kids-button-white"
          href="/downloads/family-ai-starter-pack.html"
          target="_blank"
          rel="noopener noreferrer"
        >
          <KidsIcon name="download" aria-hidden="true" /> Get the free activity
          pack
        </a>
        <form className="kids-pack-form" onSubmit={submit}>
          <label htmlFor="pack-email">
            Want December workshop details too?
          </label>
          {state === "success" ? (
            <p className="kids-pack-status" role="status">
              You’re on our enquiry list!{" "}
              <a href={workshopWhatsAppUrl(number)}>Or chat with our team →</a>
            </p>
          ) : (
            <>
              <div className="kids-pack-email">
                <input
                  id="pack-email"
                  type="email"
                  name="email"
                  placeholder="Parent’s email address"
                  required
                  maxLength={255}
                  autoComplete="email"
                />
                <button type="submit" disabled={state === "sending"}>
                  {state === "sending" ? "Sending…" : "Keep me in the loop"}
                  <KidsIcon name="arrow" aria-hidden="true" />
                </button>
              </div>
              <label className="kids-consent">
                <input required type="checkbox" />
                <span>
                  I’m a parent or guardian and agree to be contacted about
                  December workshops.{" "}
                  <Link href="/privacy">Privacy policy</Link>.
                </span>
              </label>
              <TurnstileWidget onToken={setToken} />
              {state === "error" && (
                <p role="alert">
                  We couldn’t save your request. You can still open the free
                  pack above, or{" "}
                  <a href={workshopWhatsAppUrl(number)}>WhatsApp us</a>.
                </p>
              )}
            </>
          )}
        </form>
      </div>
    </div>
  );
}
