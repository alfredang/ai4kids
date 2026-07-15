import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { getParentChildren } from "@/lib/portal-queries";
import { getBuddyTranscript } from "@/lib/buddy-chat";

export const dynamic = "force-dynamic";

export default async function ParentBuddyPage({ params }: { params: Promise<{ childId: string }> }) {
  const session = await getPortalSession();
  if (!session) redirect("/login?from=/parent/children");

  const childId = Number((await params).childId);
  const kids = await getParentChildren(Number(session.id));
  const child = kids.find((k) => k.id === childId);
  if (!child) redirect("/parent/children"); // not this parent's child

  const transcript = await getBuddyTranscript(childId);
  const firstName = child.name.split(" ")[0];

  return (
    <div>
      <Link href="/parent/children" className="font-fun text-sm font-600 text-slate-400 hover:text-coral">← Back to my kids</Link>
      <h1 className="mt-2 font-fun text-3xl font-700 text-slate-900">💬 {firstName}&apos;s Buddy chats</h1>
      <p className="mt-1 font-round text-slate-500">
        Everything {firstName} has said to their AI Talking Buddy, kept here for you to review.
      </p>

      {transcript.length === 0 ? (
        <p className="mt-6 rounded-3xl bg-white p-8 text-center text-slate-500 shadow-sm">
          {firstName} hasn&apos;t chatted with their buddy yet. 🤖
        </p>
      ) : (
        <div className="mt-6 space-y-3 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-amber-100">
          {transcript.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex flex-col items-end">
                <span className="max-w-[80%] rounded-2xl rounded-br-md bg-coral px-4 py-2 font-round text-white shadow-sm">
                  {m.content}
                </span>
                <span className="mt-0.5 pr-1 text-[10px] text-slate-400">{fmt(m.createdAt)}</span>
              </div>
            ) : (
              <div key={i} className="flex flex-col items-start">
                <div className="flex items-end gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky/15 text-lg">🤖</span>
                  <span className="max-w-[80%] rounded-2xl rounded-bl-md bg-sky/10 px-4 py-2 font-round text-slate-700 ring-1 ring-sky/20">
                    {m.content}
                  </span>
                </div>
                <span className="mt-0.5 pl-10 text-[10px] text-slate-400">{fmt(m.createdAt)}</span>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function fmt(d: Date): string {
  return new Date(d).toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
