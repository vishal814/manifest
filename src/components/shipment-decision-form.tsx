"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function ShipmentDecisionForm({ id, revision, complete, mismatch }: {
  id: string;
  revision: string;
  complete: boolean;
  mismatch: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (!submitter || pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/shipments/${id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision, decision: submitter.value, note: form.get("note") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save decision.");
      setMessage(submitter.value === "approved" ? "Approval saved." : "Shipment returned.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save decision.");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={save}>
    <label>Manager note <textarea name="note" rows={3} maxLength={1000} /></label>
    <p className="small-note">{mismatch
      ? "Explain how every cross-check discrepancy was resolved before approving. A return also requires a note."
      : "A return requires a note explaining what needs correction."}</p>
    <div className="form-actions">
      <button className="button primary" type="submit" value="approved" disabled={pending || !complete}>Approve shipment</button>{" "}
      <button className="button secondary" type="submit" value="returned" disabled={pending}>Return for correction</button>
    </div>
    {message && <p role="status">{message}</p>}
  </form>;
}
