/**
 * The `certificateThumbprintSha1` argument every COSE writer hands
 * `resolveCertBinding` — always `false`, because COSE has one thumbprint
 * parameter carrying its algorithm in the VALUE (RFC 9360 §2), so
 * `certificateThumbprintSha1` is `absent` on the COSE side of the registry.
 *
 * ⚠ Left to its default the resolver derives the SHA-1 digest anyway, and
 * `coseWireKey("x5t")` then refuses the whole mint with `header_no_cose_label`.
 *
 * ⚠ Nothing the caller states reaches here: this is the COSE half of a wire-owned
 * answer, and `internal/utils/jose-thumbprint-sha1.ts` is the JOSE one.
 */
export const COSE_THUMBPRINT_SHA1 = false;
