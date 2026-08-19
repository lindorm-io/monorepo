/**
 * The `thumbprintSha1` argument every JOSE writer hands `resolveCertBinding` —
 * always `true`, because RFC 7515 §4.1.7 registers `x5t` as a parameter of its
 * own, beside §4.1.8's `x5t#S256`. A cert-bound JOSE token therefore names its
 * certificate by BOTH digests, for the older clients that read only the legacy
 * one.
 *
 * Emitting it costs the reader nothing: where both ride, `verify-cert-binding.ts`
 * verifies the SHA-256 digest and ignores the SHA-1 one entirely, and a token
 * bound by the SHA-1 digest ALONE is refused outright in `strict` mode.
 */
export const JOSE_THUMBPRINT_SHA1 = true;
