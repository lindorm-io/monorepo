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
  /**
   * The params NO registry row answers for, per bucket, VERBATIM as the issuer
   * wrote them — the read half of the `custom` write bag
   * ({@link JoseWireTokenEnvelope}).
   *
   * They get their own field rather than joining the two above, because the typed
   * bags are typed: a `WireTokenHeader` carrying a key that type cannot express is
   * a lie a reader cannot detect. A read CARRIES an unknown and never refuses one
   * — a foreign issuer may write params aegis has never heard of, and dropping
   * them hides what the token said.
   *
   * `{ protected: {}, unprotected: {} }` on JOSE's unprotected half, for the same
   * reason `unprotectedHeader` is `{}` there: compact serialisation has no
   * unprotected bucket.
   *
   * ⚠ THE KEY TYPE IS EXACT; THE VALUE TYPE IS `unknown` FOR A REASON. A COSE
   * producer may nest a CBOR map inside a custom parameter, and the decoder hands
   * that back as a `Map` — so `CwtKit`/`CwsKit`/`CweKit` can report a value here
   * that its JOSE twin would report as a plain object for the same logical input.
   * Neither is converted: a read reports what the producer wrote, in the shape the
   * wire carries it, and normalising one into the other would invent a structure
   * on one wire or destroy label fidelity on the other (RFC 9052 §1.4 admits
   * non-string keys, which an object cannot hold). A consumer reading a custom
   * value must therefore branch on the shape, exactly as it would reading the raw
   * wire — which is what this bag is.
   *
   * ⛔ Unknowns STOP AT THE WIRE TIER. `parseTokenHeader` drops every key the
   * registry does not answer for, so nothing here reaches `VerifiedToken.header`
   * — the domain surface exists so a caller never learns the wire's vocabulary,
   * and an unregistered wire param has no domain name to learn.
   *
   * ⚠ BOTH BAGS HAVE A NULL PROTOTYPE at runtime (`Object.create(null)`), because
   * their keys come off a token a stranger wrote: `__proto__` is a legal member
   * name on both wires, and only a null-prototype target can hold it as an own key
   * instead of letting it choose the bag's prototype. A CALLER observes the
   * difference — `bag.hasOwnProperty(k)` and `bag.toString()` throw,
   * `bag instanceof Object` is `false`, and `util.inspect` prints
   * `[Object: null prototype]`. Use `Object.hasOwn(bag, k)` and `Object.keys(bag)`,
   * which is what a bag of attacker-chosen keys wants anyway.
   */
  unknown: {
    protected: Record<string, unknown>;
    unprotected: Record<string, unknown>;
  };
};
