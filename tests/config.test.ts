import { describe, expect, it } from 'vitest';
import { getSupabaseConfigError } from '../src/lib/config';

const key = 'sb_publishable_fictional_test_value';
describe('Supabase configuration validation', () => {
  it('accepts a project URL', () => expect(getSupabaseConfigError('https://example-project.supabase.co', key)).toBeNull());
  it('accepts a local Supabase instance', () => expect(getSupabaseConfigError('http://127.0.0.1:54321', key)).toBeNull());
  it.each(['not-a-url', 'your-project-url', 'sb_publishable_example', 'ftp://example.com', 'https://supabase.com/dashboard/project/example', 'https://example.supabase.co/rest/v1', 'https://user:password@example.com', 'https://example.supabase.co?key=secret', 'https://example.supabase.co#fragment', ' https://example.supabase.co'])('rejects invalid or inappropriate URL %s', url => {
    expect(getSupabaseConfigError(url, key)).toContain('Project URL');
  });
  it('requires a URL', () => expect(getSupabaseConfigError('', key)).toContain('Project URL'));
  it('requires the public key', () => expect(getSupabaseConfigError('https://example.supabase.co', '')).toContain('publishable API key'));
  it('blocks a modern server secret in the public key setting', () => expect(getSupabaseConfigError('https://example.supabase.co', 'sb_secret_fictional')).toContain('server secret'));
  it('does not put entered values into an error message', () => {
    const error = getSupabaseConfigError('private-value-not-a-url', key);
    expect(error).not.toContain('private-value-not-a-url');
    expect(error).not.toContain(key);
  });
});
