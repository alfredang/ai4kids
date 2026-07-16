import { NextResponse } from "next/server";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { getCredential } from "@/lib/secrets";
import {
  buildSystemPrompt,
  getChatbotSettings,
  getCmsKnowledgeSnippet,
  renderSystemPrompt,
} from "@/lib/chatbot-settings";
import { buildClaudeEnv, SDK_ISOLATION } from "@/lib/anthropic-auth";
import {
  buildCaptureState,
  buildLeadMessageFromHistory,
  captureDoneMessage,
  isRefusal,
  nextCapturePrompt,
  shouldYieldCapture,
  tryFaqMatch,
  tryGreeting,
  tryProductCatalog,
} from "@/lib/chatbot-harness";
import { getSiteBrand } from "@/lib/site-settings";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { computeLeadScore } from "@/lib/lead-score";
import { sendLeadEmail } from "@/lib/email";
import { getNemoLessons, reflectOnLead } from "@/lib/nemo-reflect";

export const maxDuration = 120;

type Msg = { role: "user" | "model"; content: string };

export async function POST(req: Request) {
  try {
    const { message, history = [] } = (await req.json()) as {
      message: string;
      history?: Msg[];
    };
    if (!message?.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    // ── Fast path 1: greeting → instant canned reply, no SDK spawn.
    const brand = await getSiteBrand();
    const greet = tryGreeting(message, brand.shortName);
    if (greet) return NextResponse.json({ response: greet });

    // ── Fast path 2: lead-capture flow (Nemo as lead magnet).
    //    Once a visitor expresses intent ("quote", "demo", "speak to someone"
    //    etc.), we collect Name → Email → Phone and write to the leads table
    //    + email angch@. Stateless: we replay the conversation each turn.
    const captureState = buildCaptureState(history, message);
    // Funnel discipline:
    //  - If the visitor pivoted to a question mid-capture, ANSWER the
    //    question first (FAQ → catalog → SDK). Don't re-prompt the same
    //    field — that's how Nemo ended up parroting "What's your email?".
    //  - If they refused outright, acknowledge and exit capture cleanly.
    const yieldingToQuestion = captureState.active && shouldYieldCapture(message);
    const refusing = captureState.active && isRefusal(message);
    if (refusing) {
      return NextResponse.json({
        response:
          "No problem — happy to keep chatting without taking your details. What else would you like to know about our LMS, TMS, SSG ATO, or AI services?",
      });
    }
    if (captureState.active && !yieldingToQuestion) {
      const prompt = nextCapturePrompt(captureState);
      if (prompt) {
        return NextResponse.json({ response: prompt });
      }
      // All required fields collected — persist + notify and confirm.
      if (captureState.name && captureState.email) {
        const fullHistory = [...history, { role: "user" as const, content: message }];
        const summary = buildLeadMessageFromHistory(fullHistory);
        // The qualifying-details turn is the most informative single answer;
        // pass it (concatenated with the full transcript) to the lead scorer
        // so keyword + length signals boost the score appropriately.
        const scoringMessage = [
          captureState.details ? `QUALIFYING DETAILS: ${captureState.details}` : "",
          summary,
        ]
          .filter(Boolean)
          .join("\n\n");
        const score = computeLeadScore({
          name: captureState.name,
          email: captureState.email,
          phone: captureState.phone,
          company: null,
          message: scoringMessage,
        });
        try {
          await db.insert(leads).values({
            name: captureState.name,
            email: captureState.email,
            phone: captureState.phone ?? null,
            company: "(via Nemo chatbot)",
            message: summary,
            source: "nemo",
            score,
          });
        } catch (err) {
          console.error("[chat/lead] insert failed", err);
        }
        try {
          await sendLeadEmail({
            name: captureState.name,
            email: captureState.email,
            phone: captureState.phone ?? undefined,
            company: "(via Nemo chatbot)",
            message: summary,
            source: "nemo",
          });
        } catch (err) {
          console.error("[chat/lead] email send failed", err);
        }
        // Fire-and-forget self-improvement: reflect on this transcript and
        // append any new tactical lesson to the DB-backed lessons store so
        // future conversations are coached toward a higher score.
        void reflectOnLead({ transcript: summary, score }).catch((err) =>
          console.error("[chat/lead] reflection failed", err),
        );
        return NextResponse.json({ response: captureDoneMessage(captureState) });
      }
    }

    const settings = await getChatbotSettings();

    // ── Fast path 3: admin-configured FAQ match → instant.
    const faqHit = tryFaqMatch(message, settings.faq);
    if (faqHit) return NextResponse.json({ response: faqHit });

    // ── Fast path 4: built-in product catalog (TMS, LMS, SSG ATO, TPQA,
    //    AI Agent, AI Solutions, CMS, HRMS, pricing). Instant + each answer
    //    ends with an intent keyword (demo/quote) so a follow-up triggers
    //    the lead-capture flow.
    const catalogHit = tryProductCatalog(message);
    if (catalogHit) return NextResponse.json({ response: catalogHit });

    // ── Fallback: Claude Agent SDK with subscription OAuth token.
    const token = await getCredential("anthropic_auth_token");
    if (!token) {
      return NextResponse.json(
        { error: "Chatbot not configured. Add a Claude OAuth token in Admin → Settings → Credentials." },
        { status: 503 },
      );
    }

    const [lessons, cmsSnippet] = await Promise.all([
      getNemoLessons().then((rows) => rows.map((l) => l.lesson)),
      getCmsKnowledgeSnippet(),
    ]);
    const systemPrompt = await renderSystemPrompt(
      buildSystemPrompt(settings, lessons, cmsSnippet),
    );

    const conversation = [...history, { role: "user" as const, content: message }]
      .slice(-10)
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.trim()}`)
      .filter(Boolean)
      .join("\n\n");

    let resultText = "";
    let sdkErrored = false;

    try {
      for await (const msg of query({
        prompt: conversation,
        options: {
          env: buildClaudeEnv(token),
          systemPrompt,
          // Nemo is conversational lead qualification — Haiku is fast and
          // cheap and more than enough. Sonnet is the safety net if Haiku
          // isn't available on this subscription.
          model: "haiku",
          fallbackModel: "sonnet",
          maxTurns: 1,
          // REQUIRED here — this chatbot is public and anonymous. Without it the
          // SDK loads CLAUDE.md, skills and the developer's memory into context,
          // where a prompt injection could surface them to a stranger. Nemo needs
          // only `systemPrompt`.
          ...SDK_ISOLATION,
          allowedTools: [],
          disallowedTools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch"],
        },
      })) {
        if (msg.type === "result") {
          const subtype = (msg as { subtype?: string }).subtype;
          const r = (msg as { result?: string }).result;
          if (subtype === "success" && r) {
            resultText = r;
          } else if (subtype && subtype !== "success") {
            // error_during_execution, error_max_turns, etc.
            sdkErrored = true;
            console.error("[chat] SDK error subtype:", subtype, r);
          }
        }
        if (msg.type === "assistant") {
          for (const block of msg.message.content) {
            if (block.type === "text" && !resultText) resultText += block.text;
          }
        }
      }
    } catch (sdkErr) {
      sdkErrored = true;
      console.error("[chat] SDK threw", sdkErr);
    }

    // Filter known auth / runtime error strings before they reach the visitor.
    const looksLikeError =
      sdkErrored ||
      /Claude Code returned an error result|Invalid bearer token|API Error: 4\d\d|Failed to authenticate/i.test(
        resultText,
      );
    if (looksLikeError) {
      console.error("[chat] Suppressed error response to visitor:", resultText.slice(0, 200));
      return NextResponse.json({
        response:
          "I'm having trouble reaching my brain right now — but our team can help directly. Email **sales@tertiarycourses.com.sg** or say *quote* / *demo* and I'll take your details to pass on.",
      });
    }

    return NextResponse.json({
      response: resultText.trim() || "Sorry, I couldn't generate a reply.",
    });
  } catch (err) {
    console.error("[chat] error", err);
    const message = err instanceof Error ? err.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
