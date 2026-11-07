"use client";

import { useState } from "react";

type Row = { code: string; label: string };

export function SourceLabelsEditor({ initial }: { initial: Record<string, string> }) {
  const [rows, setRows] = useState<Row[]>(
    Object.entries(initial).map(([code, label]) => ({ code, label })),
  );

  function update(i: number, field: keyof Row, value: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }
  function remove(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }
  function add() {
    setRows((prev) => [...prev, { code: "", label: "" }]);
  }

  return (
    <div className="space-y-3">
      <input
        type="hidden"
        name="source_labels_json"
        value={JSON.stringify(
          Object.fromEntries(
            rows
              .map((r) => [r.code.trim(), r.label.trim()] as const)
              .filter(([c, l]) => c && l),
          ),
        )}
      />
      {rows.length === 0 && (
        <p className="text-sm text-(--color-muted)">No source labels yet. Click "Add row" below.</p>
      )}
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-center">
          <input
            type="text"
            placeholder="source-code (e.g. free-trial)"
            value={r.code}
            onChange={(e) => update(i, "code", e.target.value)}
            className="px-3 py-2 bg-white/3 border border-white/10 rounded-lg font-mono text-xs focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition"
          />
          <input
            type="text"
            placeholder="Short label (e.g. Courseware)"
            value={r.label}
            onChange={(e) => update(i, "label", e.target.value)}
            className="px-3 py-2 bg-white/3 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-(--color-cyan) focus:ring-2 focus:ring-(--color-cyan)/20 transition"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label="Remove row"
            className="px-3 py-2 text-sm border border-white/10 rounded-lg hover:bg-white/5 transition"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="px-3 py-2 text-sm border border-white/10 rounded-lg hover:bg-white/5 transition"
      >
        + Add row
      </button>
    </div>
  );
}
