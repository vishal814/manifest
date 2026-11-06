export default function GuidePage() {
  return <><div className="page-heading"><div><span className="eyebrow accent">WORKSPACE GUIDE</span><h1>From source to certainty.</h1><p>Review source documents, resolve checks and approve the current version.</p></div></div>
  <section className="panel panel-body prose"><h2>Shipment workflow</h2><ol>
  <li>Create a shipment with a unique reference and supplier name.</li>
  <li>Upload one commercial invoice, packing list and bill of lading. Each file can be PDF, JPG or PNG, up to 10 MB and ten PDF pages. Uploaded document types disappear from the dropdown.</li>
  <li>Extract fields. Missing or low-confidence values are highlighted for review. If extraction fails or the source needs transcription, use Enter fields manually and choose the printed line-item count.</li>
  <li>Review every document beside its original. Check the fields and line totals, then save each review. Original AI values and correction history remain available.</li>
  <li>Check gross weights, net weights where stated, package counts, and invoice total against its line totals. Missing or invalid required values block approval. A manager must document how discrepancies were resolved.</li>
  <li>The manager approves or returns the shipment. Download approved CSV only after approval of the current version. Saving an edit or starting a new extraction requires approval again.</li>
  </ol><h2>Quality report</h2><p>Managers can open Accuracy report for agreement by field and supplier. It compares original AI values with saved human reviews. It does not prove accuracy against independent ground truth. Manual-only entries and blank pairs are excluded.</p>
  <h2>Access and evaluation limits</h2><p>Executives see shipments they created; managers see all shipments. Roles are assigned by the workspace owner. Per user, the evaluation allows 50 extraction/manual attempts and 100 uploaded documents over 24 hours, with burst limits. Closing the page during extraction is not a reliable background job; refresh to inspect saved results.</p>
  <h2>Handling documents</h2><p>Use fictional evaluation files. Sources are private, with two-minute preview links. Model confidence is a heuristic. Real documents need additional production safeguards and a larger accuracy evaluation. Background processing, keyboard checks and screen-reader checks remain deferred.</p></section></>;
}
