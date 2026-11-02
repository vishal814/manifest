import { describe, expect, it } from 'vitest';
import { sameOrigin } from '../src/lib/origin';

function request(origin?: string, host = '127.0.0.1:3000', extra: Record<string,string> = {}) {
  return new Request('http://localhost:3000/api/shipments', { method:'POST', headers: { host, ...(origin ? { origin } : {}), ...extra } });
}
describe('request origin protection', () => {
  it('accepts browser Host when Next.js uses a different bind hostname', () => expect(sameOrigin(request('http://127.0.0.1:3000'), '')).toBe(true));
  it('accepts the matching localhost host', () => expect(sameOrigin(request('http://localhost:3000','localhost:3000'), '')).toBe(true));
  it('rejects a different website', () => expect(sameOrigin(request('https://attacker.example'), '')).toBe(false));
  it('rejects a different port', () => expect(sameOrigin(request('http://127.0.0.1:4000'), '')).toBe(false));
  it('rejects a missing Origin', () => expect(sameOrigin(request(), '')).toBe(false));
  it('rejects opaque origins', () => expect(sameOrigin(request('null'), '')).toBe(false));
  it('rejects malformed origins', () => expect(sameOrigin(request('not-a-url'), '')).toBe(false));
  it('rejects Origin containing a path', () => expect(sameOrigin(request('http://127.0.0.1:3000/path'), '')).toBe(false));
  it('does not trust forwarded-host headers', () => expect(sameOrigin(request('https://attacker.example', '127.0.0.1:3000', {'x-forwarded-host':'attacker.example','x-forwarded-proto':'https'}), '')).toBe(false));
  it('accepts an explicit production origin behind TLS termination', () => expect(sameOrigin(request('https://manifest.example','internal:8080'), 'https://manifest.example')).toBe(true));
  it('rejects incoming host when an explicit origin differs', () => expect(sameOrigin(request('http://127.0.0.1:3000'), 'https://manifest.example')).toBe(false));
  it('fails closed on invalid production configuration', () => expect(sameOrigin(request('http://127.0.0.1:3000'), 'invalid')).toBe(false));
});
