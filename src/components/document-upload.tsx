"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2 } from "lucide-react";
import { validateFileMetadata } from "@/lib/validation";

export function DocumentUpload({ shipmentId, existingKinds }: { shipmentId: string; existingKinds: string[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [filename, setFilename] = useState("");
  if (existingKinds.length === 3) return <div className="notice success">All three document types are uploaded. Open a document below to extract its fields.</div>;
  return <form className="upload-form" onSubmit={async e => {
    e.preventDefault(); const target = e.currentTarget;
    const form = new FormData(target); const file = form.get("file");
    if (!(file instanceof File)) return;
    const issue = validateFileMetadata(file); if (issue) { setError(issue); return; }
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/shipments/${shipmentId}/documents`, { method: "POST", body: form });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      target.reset(); setFilename(""); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Upload failed. Please try again."); }
    finally { setPending(false); }
  }}><div className="upload-controls"><label>Document type<select name="kind" required defaultValue=""><option value="" disabled>Choose document type</option>{[["invoice","Commercial invoice"],["packing_list","Packing list"],["bill_of_lading","Bill of lading"]].filter(([kind]) => !existingKinds.includes(kind)).map(([kind,label]) => <option key={kind} value={kind}>{label}</option>)}</select></label><label className="upload-zone"><FileUp size={27} strokeWidth={1.5}/><strong>{filename || "Choose a document"}</strong><span>PDF, JPG or PNG · Up to 10 MB · PDFs up to 10 pages</span><input aria-label="Choose document file" name="file" type="file" accept="application/pdf,image/jpeg,image/png" required onChange={e => setFilename(e.target.files?.[0]?.name ?? "")}/></label></div>{error && <p className="error-message" role="alert">{error}</p>}<button className="button primary" disabled={pending}>{pending ? <><Loader2 size={17} className="spin"/>Uploading…</> : <><FileUp size={17}/>Upload document</>}</button></form>;
}
