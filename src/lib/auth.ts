import "server-only";
import { redirect } from "next/navigation";
import { hasSupabaseConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function requireUser() {
  if (!hasSupabaseConfig()) redirect("/setup");
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await client.from("profiles").select("id, display_name, role").eq("id", user.id).single();
  if (error || !data) throw new Error("Your profile is missing. Ask the project owner to run the database migration.");
  return { client, user, profile: data as Profile };
}
