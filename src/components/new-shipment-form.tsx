"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";

export function NewShipmentForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return <form className="stack" onSubmit={async e => {
    e.preventDefault(); setPending(true); setError("");
    const form = new FormData(e.currentTarget);
    try {
      const response = await fetch("/api/shipments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: form.get("reference"), supplier: form.get("supplier") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to create the shipment.");
      router.push(`/shipments/${result.id}`); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Connection failed. Please try again."); setPending(false); }
  }}><label>Shipment reference<input name="reference" placeholder="SHP-24811" pattern="[A-Za-z0-9_-]+" minLength={3} maxLength={40} required/><small>Use a unique reference with letters, numbers and hyphens.</small></label><label>Supplier name<input name="supplier" placeholder="Company B (China)" minLength={2} maxLength={160} required/></label>{error && <p className="error-message" role="alert">{error}</p>}<div className="form-actions"><Link className="button secondary" href="/shipments">Cancel</Link><button className="button primary" disabled={pending}>{pending ? <Loader2 size={17} className="spin"/> : <ArrowRight size={17}/>}Create shipment</button></div></form>;
}
