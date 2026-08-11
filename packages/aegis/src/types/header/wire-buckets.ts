import type { WireTokenHeader } from "./wire-header.js";

/**
 * The two header BUCKETS a kit result reports, kept apart.
 *
 * RFC 9052 §3 splits a COSE header into a protected bucket the signature / AEAD
 * covers and an unprotected bucket it does not. Merging the two into one header
 * — which every COSE kit result used to do — makes an unsigned parameter
 * indistinguishable from a signed one, so anything reading the result decides
 * policy on a value the PRESENTER could have written. Reporting them separately
 * means a reader has to name the bucket it trusts.
 *
 * The JOSE wire has no such split: compact JWS/JWE serialisation carries exactly
 * one header and it is integrity-protected, which is what
 * `KIT_CAPABILITIES.<jose kit>.unprotectedBucket: false` states. The JOSE kits
 * therefore report an EMPTY unprotected bucket rather than omitting the field —
 * one result shape across both wires, and a reader asking for the unsigned
 * parameters of a JWT gets the true answer: there are none.
 */
export type WireHeaderBuckets = {
  /** The INTEGRITY-PROTECTED header — the only bucket a signature or AEAD covers. */
  protectedHeader: WireTokenHeader;
  /**
   * The UNAUTHENTICATED header bucket: present on the wire, covered by nothing.
   * `{}` on JOSE. Nothing read from here may decide whether a token is accepted;
   * COSE convention puts the advisory `kid` routing hint in it (RFC 9052 §3.1),
   * which is the reason the bucket is surfaced at all.
   *
   * `Partial` because an unprotected bucket has no required member — not even
   * `alg`, which {@link WireTokenHeader} requires.
   */
  unprotectedHeader: Partial<WireTokenHeader>;
};
