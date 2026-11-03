"use client";

import { useState, type FormEvent } from "react";
import type { ExtractionResult } from "@/lib/validation";
import type { SavedReview } from "@/lib/review";

const labels: Record<string, string> = {
  supplier: "Supplier", buyer: "Buyer", invoiceNumber: "Invoice number",
  invoiceDate: "Invoice date", currency: "Currency", incoterm: "Incoterm",
  invoiceTotal: "Invoice total", packageCount: "Packages", grossWeightKg: "Gross weight (kg)",
  netWeightKg: "Net weight (kg)", containerNumbers: "Containers",
  description: "Description", hsn: "HSN", quantity: "Quantity", unitPrice: "Unit price", lineTotal: "Line total",
};

type Props = {
  documentId: string;
  kind: string;
  runId: string;
  extraction: ExtractionResult;
  saved: SavedReview | null;
};

export function DocumentReview({ documentId, kind, runId, extraction, saved }: Props) {
  const [open, setOpen] = useState(false);
  const [revision, setRevision] = useState(saved?.revision ?? null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  const preview = `/api/documents/${documentId}/preview`;
  const fields = Object.entries(extraction.fields);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setFeedback("");
    setFailed(false);
    try {
      const response = await fetch(`/api/documents/${documentId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId, revision,
          fields: Object.fromEntries(fields.map(([key]) => [key, form.get(key)])),
          items: extraction.items.map((item, index) =>
            Object.fromEntries(Object.keys(item).map(key => [key, form.get(`item-${index}-${key}`)]))),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save the review.");
      setRevision(result.revision);
      setFeedback("Review saved.");
    } catch (error) {
      setFailed(true);
      setFeedback(error instanceof Error ? error.message : "Unable to save the review.");
    } finally {
      setPending(false);
    }
  }

  function input(key: string, field: ExtractionResult["fields"]["supplier"], reviewed: string | null | undefined, name = key) {
    const label = key === "invoiceDate" && kind !== "invoice" ? "Document date" : labels[key];
    return <label key={name}>
      {label}
      <input name={name} defaultValue={(reviewed === undefined ? field.value : reviewed) ?? ""} maxLength={1000}/>
      <small>AI: {field.value ?? "Not found"}{field.sourcePage ? ` · Page ${field.sourcePage}` : ""}{field.value !== null ? ` · ${Math.round(field.confidence * 100)}% confidence` : ""}</small>
      {field.evidence && <small>Source: {field.evidence}</small>}
    </label>;
  }

  return <>
    <button type="button" className="button secondary" aria-expanded={open} onClick={() => setOpen(!open)}>
      {open ? "Hide review" : revision ? "Open saved review" : "Review fields"}
    </button>
    {revision && <p className="small-note">Review saved for this extraction.</p>}
    <div hidden={!open} className="review-layout">
      <div className="review-preview">
        {open && <iframe src={preview} title="Original shipment document"/>}
        <a href={preview} target="_blank" rel="noopener noreferrer">Open original in a new tab</a>
      </div>
      <form onSubmit={save} className="review-form">
        <fieldset disabled={pending}>
          <legend>Document fields</legend>
          {extraction.warnings.length > 0 && <ul className="warning-list">{extraction.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
          <div className="field-grid">
            {fields.map(([key, field]) => input(key, field, saved?.fields[key as keyof SavedReview["fields"]]))}
          </div>
        </fieldset>
        {extraction.items.map((item, index) => <fieldset key={index} disabled={pending}>
          <legend>Line item {index + 1}</legend>
          <div className="field-grid">
            {Object.entries(item).map(([key, field]) => input(key, field,
              saved?.items[index]?.[key as keyof SavedReview["items"][number]], `item-${index}-${key}`))}
          </div>
        </fieldset>)}
        <button className="button primary" disabled={pending}>{pending ? "Saving…" : "Save review"}</button>
        {feedback && <p role={failed ? "alert" : "status"} className={failed ? "error-message" : "small-note"}>{feedback}</p>}
      </form>
    </div>
  </>;
}

