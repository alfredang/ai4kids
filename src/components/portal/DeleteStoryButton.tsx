"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Small trash button on a saved story — deletes the learner's own story. */
export function DeleteStoryButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!confirm("Delete this story? This can't be undone.")) return;
    setBusy(true);
    const res = await fetch(`/api/learn/story/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      setBusy(false);
      alert("Couldn't delete that story — please try again.");
    }
  }

  return (
    <button
      onClick={del}
      disabled={busy}
      aria-label="Delete story"
      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-base shadow ring-1 ring-black/5 backdrop-blur transition hover:bg-white hover:scale-105 disabled:opacity-50"
    >
      {busy ? "⏳" : "🗑️"}
    </button>
  );
}
