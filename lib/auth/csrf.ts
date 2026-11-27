import { getAppUrl } from './service';

/**
 * Verifies that state-changing POST requests originate from the same site/origin
 * to provide defense-in-depth against CSRF alongside SameSite=Lax cookies.
 */
export function verifySameOriginRequest(request: Request): boolean {
  const secFetchSite = request.headers.get('sec-fetch-site')?.toLowerCase();
  if (secFetchSite === 'cross-site') {
    return false;
  }

  const originHeader = request.headers.get('origin');
  if (!originHeader) {
    // Allow non-browser server-to-server/test requests that omit Origin unless Sec-Fetch-Site was cross-site
    return true;
  }

  try {
    const reqOrigin = new URL(originHeader).origin;
    const urlOrigin = new URL(request.url).origin;
    const configuredOrigin = new URL(getAppUrl(urlOrigin)).origin;
    return reqOrigin === urlOrigin || reqOrigin === configuredOrigin;
  } catch {
    return false;
  }
}
