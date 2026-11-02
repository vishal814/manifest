import "server-only";
import { NextResponse } from "next/server";
import { hasSupabaseConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}
export async function apiUser() {
  if (!hasSupabaseConfig()) return null;
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  return user ? { client, user } : null;
}
