export function getSupabaseConfigError(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
): string | null {
  if (!url?.trim()) return 'Add your Project URL to NEXT_PUBLIC_SUPABASE_URL in .env.local.';
  try {
    const parsed = new URL(url);
    if (
      url !== url.trim() || /\s/.test(url) ||
      !['http:', 'https:'].includes(parsed.protocol) ||
      !parsed.hostname || parsed.username || parsed.password ||
      parsed.pathname !== '/' || parsed.search || parsed.hash ||
      parsed.hostname === 'supabase.com' || parsed.hostname.endsWith('.supabase.com')
    ) throw new Error('Invalid project URL');
  } catch {
    return 'NEXT_PUBLIC_SUPABASE_URL must be your Project URL, such as https://your-project-id.supabase.co. Copy it from your current project Overview; do not use an API key or dashboard address.';
  }
  if (!publishableKey?.trim()) return 'Add your publishable API key to NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.';
  if (publishableKey.trim().startsWith('sb_secret_')) return 'The public-key setting contains a server secret key. Use a publishable key for NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.';
  return null;
}

export function hasSupabaseConfig() {
  return getSupabaseConfigError() === null;
}

export function hasAIConfig() {
  return Boolean(process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_LOCATION && process.env.VERTEX_MODEL);
}
