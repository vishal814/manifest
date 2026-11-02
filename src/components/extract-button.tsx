"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ScanLine } from "lucide-react";

export function ExtractButton({ documentId, completed, processing, configured }: { documentId: string; completed: boolean; processing: boolean; configured: boolean }) {
  const router = useRouter(); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  return <div className="extract-action"><button className="button secondary" disabled={pending || !configured} onClick={async () => {
    setPending(true); setError("");
    try { const response = await fetch(`/api/documents/${documentId}/extract`, { method: "POST" }); const result = await response.json(); if (!response.ok) throw new Error(result.error); }
    catch (err) { setError(err instanceof Error ? err.message : "Connection failed. Reload the shipment to check its status before retrying."); }
    finally { setPending(false); router.refresh(); }
  }}>{pending ? <Loader2 size={16} className="spin"/> : <ScanLine size={16}/>} {pending ? "Reading document…" : processing ? "Check / retry extraction" : completed ? "Extract again" : "Extract fields"}</button>{!configured && <small>Extraction needs server configuration.</small>}{error && <p className="error-message" role="alert">{error}</p>}</div>;
}
