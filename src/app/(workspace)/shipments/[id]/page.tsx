import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, FileText, RefreshCw, ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { hasAIConfig } from "@/lib/config";
import { extractionSchema, uuidSchema } from "@/lib/validation";
import type { Document, ExtractionRun, Shipment } from "@/lib/types";
import { DocumentUpload } from "@/components/document-upload";
import { DocumentReview } from "@/components/document-review";
import { compareGrossWeights, grossWeightKg } from "@/lib/cross-checks";
import { readReview } from "@/lib/review";
import { ExtractButton } from "@/components/extract-button";

const labels: Record<string, string> = { invoice: "Commercial invoice", packing_list: "Packing list", bill_of_lading: "Bill of lading", draft: "Draft", processing: "Processing", needs_review: "Needs review" };

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
  const latestRuns = new Map<string, ExtractionRun>();
  for (const run of runs) {
    if (!latestRuns.has(run.document_id)) latestRuns.set(run.document_id, run);
  }
  const reviewedDocuments = documents.filter(doc => readReview(latestRuns.get(doc.id)?.result));
  const weights = (["invoice", "packing_list", "bill_of_lading"] as const).map(kind => {
    const document = documents.find(doc => doc.kind === kind);
    const run = document ? latestRuns.get(document.id) : undefined;
    const extraction = extractionSchema.safeParse(run?.result);
    const review = readReview(run?.result);
    const raw = review ? review.fields.grossWeightKg : extraction.data?.fields.grossWeightKg.value;
    return {
      kind,
      document,
      reviewed: Boolean(review),
      weight: run?.status === "completed" ? grossWeightKg(raw) : null,
    };
  });
  const check = compareGrossWeights(weights.map(row => row.weight));
  const formatWeight = new Intl.NumberFormat("en-IN", { maximumSignificantDigits: 15 });
  const configured = hasAIConfig() && Boolean(process.env.SUPABASE_SECRET_KEY);
  return <><Link href="/shipments" className="back-link"><ArrowLeft size={16}/>All shipments</Link><div className="page-heading"><div><span className="eyebrow accent">SHIPMENT WORKSPACE</span><h1>{shipment.reference}</h1><p>{shipment.supplier}</p></div><span className={`status ${shipment.status}`}>{labels[shipment.status]}</span></div>
    <div className="notice"><ShieldAlert size={19}/><span><strong>Document review.</strong> Compare extracted values with the original and save any corrections.</span></div>
    {process.env.GOOGLE_CLOUD_LOCATION === "global" && <p className="notice">Global demo extraction is available for the three original Manifest sample PDFs.</p>}
    <section className="panel"><div className="panel-title"><h2>Source documents</h2><span className="count">{documents.length} / 3 uploaded</span></div><div className="panel-body"><DocumentUpload shipmentId={id} existingKinds={documents.map(d => d.kind)}/></div></section>
    <section className="panel">
      <div className="panel-title"><h2>Shipment cross-checks</h2></div>
      <div className="panel-body">
        <h3>Gross weight</h3>
        {check.status === "mismatch" && <p className="error-message"><strong>Weight mismatch.</strong> The highest and lowest values differ by {formatWeight.format(check.difference)} kg.</p>}
        {check.status === "pending" && <p className="small-note">Waiting for a valid gross weight from all three documents.</p>}
        {check.status === "match" && <p className="notice">Gross weight matches across all three documents.</p>}
        <dl>
          {weights.map(({ kind, document, reviewed, weight }) => <div key={kind}>
            <dt>{document ? <a className="back-link" href={`#document-${document.id}`}>{labels[kind]}</a> : labels[kind]}</dt>
            <dd>{weight === null ? "No valid gross weight yet" : `${formatWeight.format(weight)} kg · ${reviewed ? "Saved review" : "AI extraction"}`}</dd>
          </div>)}
        </dl>
      </div>
    </section>
    <div className="section-heading"><h2>Extraction workspace</h2><Link href={`/shipments/${id}`} className="back-link"><RefreshCw size={15}/>Refresh status</Link></div>
    {reviewedDocuments.length > 0 && <p className="notice">
      <span><strong>Saved reviews:</strong>{" "}
        {reviewedDocuments.map((doc, index) => <span key={doc.id}>
          {index > 0 && ", "}
          <a href={`#document-${doc.id}`} style={{ textDecoration: "underline" }}>{labels[doc.kind]}</a>
        </span>)}
      </span>
    </p>}
    {!documents.length && <div className="empty-state panel"><FileText size={30} className="muted"/><h3>Start with the original.</h3><p>Upload a document above. Its extracted fields will appear here.</p></div>}
    {documents.map(doc => {
      const run = latestRuns.get(doc.id); const parsed = extractionSchema.safeParse(run?.result);
      return <section id={`document-${doc.id}`} className="panel document-panel" key={doc.id}><div className="panel-title"><div><h2>{labels[doc.kind]}</h2><span className="small-note">{doc.filename} · {(doc.size_bytes/1024).toFixed(0)} KB</span></div><a href={`/api/documents/${doc.id}/preview`} target="_blank" rel="noopener noreferrer" className="button secondary">Open original<ArrowUpRight size={16}/></a></div><div className="panel-body"><ExtractButton documentId={doc.id} completed={run?.status === "completed"} processing={run?.status === "processing"} configured={configured}/>{run?.status === "failed" && <p role="alert" className="error-message">{run.error_message}</p>}{run?.status === "processing" && <p className="small-note">Extraction is in progress. Refresh to see the result. If an attempt was interrupted, retry after three minutes.</p>}
      {parsed.success && run && <DocumentReview key={run.id} documentId={doc.id} kind={doc.kind} runId={run.id} extraction={parsed.data} saved={readReview(run.result)}/>}
      {!run && <p className="small-note">The original is safely stored. Start extraction when your AI connection is ready.</p>}</div></section>;
    })}</>;
}
