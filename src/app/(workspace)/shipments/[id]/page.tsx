import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, FileText, RefreshCw, ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { hasAIConfig } from "@/lib/config";
import { extractionSchema, uuidSchema } from "@/lib/validation";
import type { Document, ExtractionRun, Shipment } from "@/lib/types";
import { DocumentUpload } from "@/components/document-upload";
import { ExtractButton } from "@/components/extract-button";

const labels: Record<string, string> = { invoice: "Commercial invoice", packing_list: "Packing list", bill_of_lading: "Bill of lading", draft: "Draft", processing: "Processing", needs_review: "Needs review" };
const fieldLabels: Record<string, string> = { supplier: "Supplier", buyer: "Buyer", invoiceNumber: "Invoice number", invoiceDate: "Invoice date", currency: "Currency", incoterm: "Incoterm", invoiceTotal: "Invoice total", packageCount: "Packages", grossWeightKg: "Gross weight (kg)", netWeightKg: "Net weight (kg)", containerNumbers: "Containers" };

export default async function ShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { client } = await requireUser(); const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const { data: record, error } = await client.from("shipments").select("*").eq("id", id).single();
  if (error && error.code !== "PGRST116") throw new Error("Unable to load this shipment.");
  if (!record) notFound();
  const shipment = record as Shipment;
  const { data: docs, error: docsError } = await client.from("documents").select("*").eq("shipment_id", id).order("created_at");
  if (docsError) throw new Error("Unable to load the shipment documents.");
  const documents = (docs ?? []) as Document[];
  let runs: ExtractionRun[] = [];
  if (documents.length) {
    const { data, error: runsError } = await client.from("extraction_runs").select("id,document_id,status,result,error_message,created_at").in("document_id", documents.map(d => d.id)).order("created_at", { ascending: false });
    if (runsError) throw new Error("Unable to load extraction results.");
    runs = (data ?? []) as ExtractionRun[];
  }
  const configured = hasAIConfig() && Boolean(process.env.SUPABASE_SECRET_KEY);
  return <><Link href="/shipments" className="back-link"><ArrowLeft size={16}/>All shipments</Link><div className="page-heading"><div><span className="eyebrow accent">SHIPMENT WORKSPACE</span><h1>{shipment.reference}</h1><p>{shipment.supplier}</p></div><span className={`status ${shipment.status}`}>{labels[shipment.status]}</span></div>
    <div className="notice"><ShieldAlert size={19}/><span><strong>Day 1 foundation.</strong> Upload and AI extraction are implemented. Field editing, cross-checks, approvals and exports are scheduled for the next milestones. Extracted values are unverified.</span></div>
    {process.env.GOOGLE_CLOUD_LOCATION === "global" && <p className="notice">Global demo extraction is available for the three original Manifest sample PDFs.</p>}
    <section className="panel"><div className="panel-title"><h2>Source documents</h2><span className="count">{documents.length} / 3 uploaded</span></div><div className="panel-body"><DocumentUpload shipmentId={id} existingKinds={documents.map(d => d.kind)}/></div></section>
    <div className="section-heading"><h2>Extraction workspace</h2><Link href={`/shipments/${id}`} className="back-link"><RefreshCw size={15}/>Refresh status</Link></div>
    {!documents.length && <div className="empty-state panel"><FileText size={30} className="muted"/><h3>Start with the original.</h3><p>Upload a document above. Its extracted fields will appear here.</p></div>}
    {documents.map(doc => {
      const run = runs.find(r => r.document_id === doc.id); const parsed = extractionSchema.safeParse(run?.result);
      return <section className="panel document-panel" key={doc.id}><div className="panel-title"><div><h2>{labels[doc.kind]}</h2><span className="small-note">{doc.filename} · {(doc.size_bytes/1024).toFixed(0)} KB</span></div><a href={`/api/documents/${doc.id}/preview`} target="_blank" rel="noopener noreferrer" className="button secondary">Open original<ArrowUpRight size={16}/></a></div><div className="panel-body"><ExtractButton documentId={doc.id} completed={run?.status === "completed"} processing={run?.status === "processing"} configured={configured}/>{run?.status === "failed" && <p role="alert" className="error-message">{run.error_message}</p>}{run?.status === "processing" && <p className="small-note">Extraction is in progress. Refresh to see the result. If an attempt was interrupted, retry after three minutes.</p>}
      {parsed.success && <><p className="small-note">AI confidence is a heuristic, not a measured accuracy score. All values require human review.</p><div className="field-grid">{Object.entries(parsed.data.fields).map(([key, field]) => <div key={key} className={`field-card ${field.value === null || field.confidence < 0.85 ? "uncertain" : ""}`}><span>{fieldLabels[key]}</span><strong>{field.value ?? "Not found"}</strong><small>{field.value === null ? "Manual entry needed" : `${Math.round(field.confidence*100)}% AI confidence`}{field.sourcePage ? ` · Page ${field.sourcePage}` : ""}</small>{field.evidence && <p>{field.evidence}</p>}</div>)}</div>{parsed.data.items.length > 0 && <div className="table-scroll"><table><caption>Extracted line items — unverified</caption><thead><tr><th>Description</th><th>HSN</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{parsed.data.items.map((item,index) => <tr key={index}>{[item.description,item.hsn,item.quantity,item.unitPrice,item.lineTotal].map((f,i) => <td key={i} className={f.value === null || f.confidence < 0.85 ? "uncertain-text" : ""}>{f.value ?? "Not found"}<small className="cell-confidence">{Math.round(f.confidence*100)}% confidence</small></td>)}</tr>)}</tbody></table></div>}{parsed.data.warnings.length > 0 && <ul className="warning-list">{parsed.data.warnings.map((warning,i) => <li key={i}>{warning}</li>)}</ul>}</>}
      {!run && <p className="small-note">The original is safely stored. Start extraction when your AI connection is ready.</p>}</div></section>;
    })}</>;
}
