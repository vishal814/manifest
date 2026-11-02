"use client";
import { useActionState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { signIn } from "@/app/login/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, { error: "" });
  return <form action={action} className="stack"><label>Email address<input type="email" name="email" autoComplete="email" placeholder="you@company.example" required/></label><label>Password<input type="password" name="password" autoComplete="current-password" minLength={8} maxLength={128} required/></label>{state.error && <p className="error-message" role="alert">{state.error}</p>}<button className="button primary full" disabled={pending}>{pending ? <><Loader2 size={18} className="spin"/>Signing in…</> : <>Sign in to your workspace<ArrowRight size={18}/></>}</button></form>;
}
