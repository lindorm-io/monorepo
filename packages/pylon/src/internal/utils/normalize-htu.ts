// Produce a normalized htu string for comparison with a DPoP proof's htu
// claim (RFC 9449 §4.1). Normalization is the RFC 3986 §6.2.2 subset we
// care about in practice: lowercase scheme, lowercase host, stripped
// default port, no query, no fragment.
export const normalizeHtu = (origin: string, path: string): string => {
  const url = new URL(`${origin}${path}`);
  return `${url.protocol}//${url.host}${url.pathname}`;
};
