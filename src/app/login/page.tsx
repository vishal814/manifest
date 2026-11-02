import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/login-form";
import { hasSupabaseConfig } from "@/lib/config";
export default function LoginPage() {
  if (!hasSupabaseConfig()) redirect("/setup");
  return <main className="login-page"><Link href="/" aria-label="Manifest home"><Brand/></Link><section className="login-card"><span className="eyebrow accent">YOUR DOCUMENT WORKSPACE</span><h1>Welcome back.</h1><p>Sign in to pick up your next shipment.</p><LoginForm/><p className="small-note">Accounts are provisioned by your workspace owner. Contact them if you need access.</p></section><span className="eyebrow muted">LESS RETYPING. MORE CERTAINTY.</span></main>;
}
