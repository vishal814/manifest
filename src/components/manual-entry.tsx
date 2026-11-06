"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
export function ManualEntry({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/documents/${documentId}/manual`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lineCount: Number(form.get("lineCount")) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to start manual entry.");
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to start manual entry."); }
    finally { setPending(false); }
  }
  return <details><summary>Enter fields manually</summary><p className="small-note">Use this if extraction fails or the source needs manual transcription. Choose the number of line items printed in the document before starting.</p><form onSubmit={start}><label>Line items<input name="lineCount" type="number" min={1} max={200} defaultValue={1} required/></label><button className="button secondary" disabled={pending}>{pending ? "Preparing…" : "Start manual entry"}</button>{error && <p role="alert" className="error-message">{error}</p>}</form></details>;
}
