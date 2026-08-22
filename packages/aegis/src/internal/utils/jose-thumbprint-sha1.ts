/**
 * The `thumbprintSha1` argument every JOSE writer hands `resolveCertBinding` —
 * always `true`, so a cert-bound JOSE token names its certificate by BOTH digests
 * (RFC 7515 §4.1.7, RFC 7515 §4.1.8), for the older clients that read only the
 * legacy one.
 *
 * Emitting it costs the reader nothing: where both ride, `verify-cert-binding.ts`
 * verifies the SHA-256 digest and ignores the SHA-1 one entirely, and a token
 * bound by the SHA-1 digest ALONE is refused outright in `strict` mode.
 */
export const JOSE_THUMBPRINT_SHA1 = true;
