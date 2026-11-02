/** Check browser Origin against the configured public origin or incoming Host.
 * Next.js may reconstruct request.url using the server's bind hostname, which
 * differs from the host in the browser. Do not trust forwarded-host headers.
 */
export function sameOrigin(request: Request, appOrigin = process.env.APP_ORIGIN): boolean {
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return false;
  try {
    const supplied = new URL(origin);
    if (!['http:', 'https:'].includes(supplied.protocol) || supplied.origin !== origin) return false;
    if (appOrigin) {
      const configured = new URL(appOrigin);
      if (!['http:', 'https:'].includes(configured.protocol) || configured.username || configured.password || configured.pathname !== '/' || configured.search || configured.hash) return false;
      return origin === configured.origin;
    }
    const requestUrl = new URL(request.url);
    const host = request.headers.get('host') ?? requestUrl.host;
    if (!host || /[\s,/@\\?#]/.test(host)) return false;
    const expected = new URL(`${requestUrl.protocol}//${host}`);
    return origin === expected.origin;
  } catch {
    return false;
  }
}
