import Link from "next/link";
export default function NotFound() { return <main className="standalone-state"><span className="eyebrow accent">RECORD NOT FOUND</span><h1>This page isn’t available.</h1><p>The record may not exist, or you may not have access.</p><Link href="/shipments" className="button primary">Back to shipments</Link></main>; }
