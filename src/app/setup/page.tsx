import { ArrowUpRight, Check, Circle, FileCheck2, ShieldCheck, ScanLine } from "lucide-react";
import { Brand } from "@/components/brand";
import { getSupabaseConfigError, hasAIConfig, hasSupabaseConfig } from "@/lib/config";

export default function SetupPage() {
  const databaseReady = hasSupabaseConfig();
  return <main className="setup-page">
    <header className="public-header"><Brand/><span className="eyebrow">IMPORT DOCUMENT WORKSPACE</span><span className="phase-pill">DAY 01 · FOUNDATION</span></header>
    <div className="setup-grid">
      <section className="setup-intro"><span className="eyebrow accent">LESS RETYPING. MORE CERTAINTY.</span><h1>Every shipment.<br/>A clearer picture.</h1><p className="lead">From a folder of documents to data you can trust. A calm workspace for the people behind every clearance.</p>
        <div className="document-art" aria-label="Invoice extraction illustration"><div className="art-back"/><div className="art-document"><span className="eyebrow">COMMERCIAL INVOICE</span><div className="art-heading">Company B<span>INV-24811</span></div><div className="art-line"/><div className="art-row"><span>LED panel light 40W</span><b>2,400 units</b></div><div className="art-row"><span>Unit price</span><b>USD 6.80</b></div><div className="art-row"><span>Gross weight</span><b>3,120 kg</b></div><div className="art-total"><span>Invoice total</span><b>USD 16,320.00</b></div><span className="art-caption">FICTIONAL SAMPLE DOCUMENT</span></div><div className="art-tag"><ScanLine size={18}/><div><strong>Read. Review. Resolve.</strong><span>Original documents stay within reach.</span></div></div></div>
        <div className="trust-row"><ShieldCheck size={17}/><span>Private documents</span><span className="separator">/</span><FileCheck2 size={17}/><span>Human review built in</span></div>
      </section>
      <section className="setup-card"><div className="card-overline"><span className="live-dot"/>WORKSPACE SETUP</div><h2>A solid start.</h2><p>Connect your services to start working with real shipments. Sample artwork on this page is illustrative.</p>
        <ol className="setup-steps">
          <li><span className="step-number">01</span><div><h3>Create your Supabase project</h3><p>Choose Mumbai. Copy the project URL and publishable key into <code>.env.local</code>.</p></div>{databaseReady ? <Check className="accent" size={20}/> : <Circle className="muted" size={18}/>}</li>
          <li><span className="step-number">02</span><div><h3>Prepare the database</h3><p>Run the SQL migration in <code>supabase/migrations</code>. It creates the tables, private bucket and access policies.</p></div></li>
          <li><span className="step-number">03</span><div><h3>Add your team</h3><p>Create test users in Supabase Auth. New users start as executives; promote a manager using the README instructions.</p></div></li>
          <li><span className="step-number">04</span><div><h3>Connect document extraction</h3><p>Configure a Vertex AI project, an available model and Application Default Credentials.</p></div>{hasAIConfig() ? <Check className="accent" size={20}/> : null}</li>
        </ol>
        {databaseReady ? <a href="/login" className="button primary full">Continue to sign in<ArrowUpRight size={18}/></a> : <div className="connection-note"><Circle size={15}/><span>{getSupabaseConfigError()} Restart the app after updating .env.local.</span></div>}
        <p className="small-note">Configuration format is checked here. Database migrations, credentials and provider connectivity are verified when you use the app.</p>
      </section>
    </div><footer className="public-footer"><span>MANIFEST / DOCUMENT OPERATIONS</span><span>Built for a careful review.</span></footer>
  </main>;
}

