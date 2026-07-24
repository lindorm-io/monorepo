/**
 * A DNS resolver hook forwarded to the Node `http` transport's `lookup` option
 * (axios). Given a hostname it returns the address to CONNECT to — the seam for
 * SSRF IP-pinning: a consumer resolves + validates ONCE and returns the vetted
 * address, so the socket connects to exactly that IP while the request's `Host`
 * header and TLS SNI keep the original hostname. Because it is the only
 * resolution the transport performs, there is no connect-time re-resolve — which
 * closes the check-time/connect-time (TOCTOU / DNS-rebinding) gap.
 *
 * TYPE ONLY — conduit forwards the function value but never resolves DNS itself,
 * so this adds no Node builtin to conduit's browser-safe import closure. The
 * `http` adapter honours it; the `fetch` adapter (browser) ignores it.
 */
export type ConduitLookup = (
  hostname: string,
  options: { all?: boolean; family?: number },
) => Promise<{ address: string; family: 4 | 6 }>;
