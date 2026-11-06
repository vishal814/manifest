import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadShipmentRegister } from "@/lib/shipment-approval-data";
import { reviewAgreement } from "@/lib/accuracy";
import { reviewFieldLabels } from "@/lib/review";

export default async function ReportsPage() {
  const { client, profile } = await requireUser();
  if (profile.role !== "manager") notFound();
  const { snapshots, error } = await loadShipmentRegister(client);
  if (error) throw new Error("Unable to load the accuracy report.");
  const report = reviewAgreement(snapshots.flatMap(({ shipment, state }) => state.records.filter(record => record.run?.status === "completed").map(record => ({ supplier: shipment.supplier, result: record.run?.result }))));
  const table = (rows: typeof report.fields, labels: boolean) => <div className="table-scroll"><table><thead><tr><th>{labels ? "Field" : "Supplier"}</th><th>Compared values</th><th>Unchanged after review</th><th>Agreement</th></tr></thead><tbody>{rows.map(row => <tr key={row.name}><td>{labels ? reviewFieldLabels[row.name] ?? row.name : row.name}</td><td>{row.compared}</td><td>{row.agreed}</td><td>{(100 * row.agreed / row.compared).toFixed(1)}%</td></tr>)}</tbody></table></div>;
  return <><div className="page-heading"><div><span className="eyebrow accent">QUALITY REPORT</span><h1>Extraction and review.</h1><p>{report.reviewedDocuments} reviewed documents in the most recent {snapshots.length} visible shipments (maximum 200).</p></div></div>
  <p className="notice">Review agreement compares original AI values with the latest saved human review. It is not independently measured accuracy. Unchanged errors can still agree. Blank-to-blank fields and manual-only entries are excluded.</p>
  {report.reviewedDocuments ? <><section className="panel"><div className="panel-title"><h2>By field</h2></div>{table(report.fields, true)}</section><section className="panel"><div className="panel-title"><h2>By supplier</h2></div>{table(report.suppliers, false)}</section></> : <section className="panel panel-body"><h2>No reviewed AI results yet</h2><p>Extract a document and save a human review to populate this report.</p></section>}
  <p className="small-note">Numeric formatting and equivalent weight units are normalized. Line items are compared by row. Supplier groups use the shipment supplier. AI confidence percentages are separate from these observed results.</p></>;
}
