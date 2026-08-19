/**
 * The `certificateThumbprintSha1` argument every COSE writer hands
 * `resolveCertBinding` — always `false`, because there is no COSE parameter for
 * the value to travel under.
 *
 * RFC 9360 §2 gives COSE ONE thumbprint parameter, `x5t` (label 34), whose value
 * is a `COSE_CertHash` — the hash algorithm is a member of the value rather than
 * the difference between two parameter names — so `certificateThumbprintSha1` is
 * `absent` on the COSE side of the header registry. Left to its default the
 * resolver derives the SHA-1 digest anyway, and `coseWireKey("x5t")` would then
 * refuse the whole mint with `header_no_cose_label`.
 *
 * ⚠ Nothing the caller states reaches here. Which digests name a certificate is
 * the wire's own answer on both sides — this constant is the COSE half, and
 * `internal/utils/jose-thumbprint-sha1.ts` is the JOSE one.
 */
export const COSE_THUMBPRINT_SHA1 = false;
