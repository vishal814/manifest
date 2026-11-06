import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const attempts = new Map<string, { count: number; expires: number }>();
export async function checkUsage(client: SupabaseClient, userId: string, operation: "upload" | "extraction") {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
  const key = operation + ":" + userId;
  const current = attempts.get(key) ?? { count: 0, expires: now + 60_000 };
  current.count++; attempts.set(key, current);
  const perMinute = operation === "extraction" ? 10 : 20;
  if (current.count > perMinute) return "Too many requests. Wait a minute before trying again.";
  const table = operation === "extraction" ? "extraction_runs" : "documents";
  const owner = operation === "extraction" ? "requested_by" : "created_by";
  const { count, error } = await client.from(table).select("id", { count: "exact", head: true })
    .eq(owner, userId).gte("created_at", new Date(now - 86_400_000).toISOString());
  if (error) return "Usage could not be verified. Please try again later.";
  if ((count ?? 0) >= (operation === "extraction" ? 50 : 100)) return "Your daily evaluation limit has been reached. Try again tomorrow.";
  return null;
}
