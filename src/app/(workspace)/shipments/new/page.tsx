import Link from "next/link";
import { ArrowLeft, Files } from "lucide-react";
import { NewShipmentForm } from "@/components/new-shipment-form";
export default function NewShipmentPage() {
  return <><Link href="/shipments" className="back-link"><ArrowLeft size={16}/>All shipments</Link><div className="page-heading"><div><span className="eyebrow accent">START A NEW RECORD</span><h1>One shipment. One place.</h1><p>Add the basics first. Your documents come next.</p></div></div><section className="panel form-panel"><div className="panel-title"><h2>Shipment details</h2><Files size={20} className="muted"/></div><div className="panel-body"><NewShipmentForm/></div></section><p className="footer-note">Only use fictional sample data while evaluating this application.</p></>;
}
