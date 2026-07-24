import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DEFAULT_SYSTEM_PROMPT,
  getChatbotSettings,
  saveChatbotSettings,
  type FaqEntry,
} from "@/lib/chatbot-settings";
import { isCredentialSet } from "@/lib/secrets";
import { SavedToast } from "@/app/admin/_components/SavedToast";
import { requireStaff } from "@/lib/admin-guard";

export default async function ChatbotSettingsPage() {
  const current = await getChatbotSettings();
  const claudeReady = await isCredentialSet("anthropic_auth_token");

  async function save(formData: FormData) {
    "use server";
    await requireStaff();
    const systemPrompt = String(formData.get("systemPrompt") ?? "");
    const questions = formData.getAll("faq_question").map((v) => String(v));
    const answers = formData.getAll("faq_answer").map((v) => String(v));
    const faq: FaqEntry[] = [];
    for (let i = 0; i < Math.max(questions.length, answers.length); i++) {
      const q = (questions[i] ?? "").trim();
      const a = (answers[i] ?? "").trim();
      if (q && a) faq.push({ question: q, answer: a });
    }
    await saveChatbotSettings({ systemPrompt, faq });
    revalidatePath("/admin/settings/chatbot");
    redirect("/admin/settings/chatbot?saved=1");
  }

  async function resetPrompt() {
    "use server";
    await requireStaff();
    await saveChatbotSettings({ systemPrompt: DEFAULT_SYSTEM_PROMPT, faq: current.faq });
    revalidatePath("/admin/settings/chatbot");
    redirect("/admin/settings/chatbot?saved=1");
  }

  const faqRows: FaqEntry[] =
    current.faq.length > 0
      ? current.faq
      : [{ question: "", answer: "" }];

  return (
    <div className="space-y-8">
      <SavedToast />
      <div>
        <h2 className="font-display text-xl font-bold">AI chatbot</h2>
        <p className="text-sm text-(--color-muted) mt-1">
          Configure AI Chatbot, the public site assistant powered by the Claude Agent SDK and your
          subscription OAuth token. Edit the system prompt that defines its persona and add
          FAQ entries that the agent will reference when replying.
        </p>
        {!claudeReady && (
          <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            ⚠ No Claude OAuth subscription token configured. AI Chatbot will return a 503
            until you add one in{" "}
            <a className="underline" href="/admin/settings/credentials">
              Settings → Credentials
            </a>
            .
          </div>
        )}
      </div>

      <form action={save} className="space-y-8">
        <section className="glass p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold">System prompt</h3>
              <p className="text-xs text-(--color-muted) mt-1">
                Persona, tone and hard rules. Used on every chat request.
              </p>
            </div>
            <button
              type="submit"
              formAction={resetPrompt}
              className="text-xs text-white/60 hover:text-(--color-cyan)"
            >
              Reset to default
            </button>
          </div>
          <textarea
            name="systemPrompt"
            defaultValue={current.systemPrompt}
            rows={16}
            className="w-full px-4 py-3 bg-white/3 border border-white/10 rounded-lg font-mono text-xs leading-relaxed focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition"
          />
        </section>

        <section className="glass p-6 space-y-4">
          <div>
            <h3 className="font-display text-lg font-semibold">FAQ</h3>
            <p className="text-xs text-(--color-muted) mt-1">
              These question/answer pairs are appended to the system prompt as
              authoritative reference for the agent. Empty rows are ignored.
            </p>
          </div>

          <FaqEditor rows={faqRows} />
        </section>

        <div className="flex items-center justify-end gap-3">
          <button className="btn-primary">Save chatbot settings</button>
        </div>
      </form>
    </div>
  );
}

function FaqEditor({ rows }: { rows: FaqEntry[] }) {
  return (
    <div id="faq-rows" className="space-y-3">
      {rows.map((row, i) => (
        <FaqRow key={i} row={row} index={i} />
      ))}
      {/* Extra blank row to make it easy to append */}
      <FaqRow row={{ question: "", answer: "" }} index={rows.length} />
    </div>
  );
}

function FaqRow({ row, index }: { row: FaqEntry; index: number }) {
  return (
    <div className="grid grid-cols-12 gap-2 items-start">
      <div className="col-span-1 pt-2 text-[10px] uppercase tracking-wider text-white/40">
        #{index + 1}
      </div>
      <input
        name="faq_question"
        defaultValue={row.question}
        placeholder="Question"
        className="col-span-4 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded focus:outline-none focus:border-(--color-cyan)"
      />
      <textarea
        name="faq_answer"
        defaultValue={row.answer}
        placeholder="Answer"
        rows={2}
        className="col-span-7 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded focus:outline-none focus:border-(--color-cyan)"
      />
    </div>
  );
}
