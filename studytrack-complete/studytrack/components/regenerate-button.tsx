"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

type Props = {
  reviewerId: string;
  kind: "flashcards" | "quiz";
  /** Called with the new items so the parent can replace its state. */
  onDone: (items: any[]) => void;
};

export function RegenerateButton({ reviewerId, kind, onDone }: Props) {
  const [loading, setLoading] = useState(false);
  const [style, setStyle] = useState("fresh");
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    if (!confirm(`Replace your current ${kind} with a new set?`)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviewers/${reviewerId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, style }),
      });
      if (!res.ok) throw new Error();
      const { items } = await res.json();
      onDone(items);
    } catch {
      setError("Could not regenerate. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <select
        value={style}
        onChange={(e) => setStyle(e.target.value)}
        disabled={loading}
        className="rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm"
        aria-label="Style of new set"
      >
        <option value="fresh">Fresh angle</option>
        <option value="easier">Easier</option>
        <option value="harder">Harder</option>
      </select>

      <button
        type="button"
        onClick={regenerate}
        disabled={loading}
        className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Regenerating..." : kind === "quiz" ? "New quiz" : "New flashcards"}
      </button>

      {error && <p className="w-full text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}
