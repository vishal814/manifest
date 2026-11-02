"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/config";
import { loginSchema } from "@/lib/validation";

export async function signIn(_: { error: string }, form: FormData) {
  if (!hasSupabaseConfig()) return { error: "Connect Supabase before signing in." };
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter a valid email and a password of at least 8 characters." };
  const client = await createClient();
  const { error } = await client.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Unable to sign in. Check your credentials and try again." };
  redirect("/shipments");
}

export async function signOut() {
  if (hasSupabaseConfig()) { const client = await createClient(); await client.auth.signOut(); }
  redirect("/login");
}
