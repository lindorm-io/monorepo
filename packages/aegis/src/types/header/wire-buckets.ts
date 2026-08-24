import type { WireTokenHeader } from "./wire-header.js";

/**
 * The header buckets a JOSE kit result reports.
 *
 * Compact JWS/JWE serialisation carries exactly ONE header and it is
 * integrity-protected (RFC 7515 §7.1, RFC 7516 §7.1). There is no second bucket for
 * a name like `protected` to contrast with, so the field is `header` —
 * the read twin of {@link JoseWireTokenEnvelope}'s write bag. Type-pinned in
 * `types/header/wire-envelope.test.ts`.
 */
export type JoseHeaderBuckets = {
  /** The ONE header, covered by the signature or AEAD. */
  header: WireTokenHeader;
  /**
   * The params NO registry row answers for, VERBATIM as the issuer wrote them —
   * the read half of the `custom` write bag ({@link JoseWireTokenEnvelope}), and
   * nested under the same bucket name so a caller writes and reads one spelling.
   *
   * They get their own field rather than joining {@link header}, because the typed
   * bag is typed: a `WireTokenHeader` carrying a key that type cannot express is a
   * lie a reader cannot detect. A read CARRIES a custom param and never refuses
   * one — a foreign issuer may write params aegis has never heard of, and dropping
   * them hides what the token said.
   *
   * ⛔ CUSTOM PARAMS STOP AT THE WIRE TIER. `parseTokenHeader` drops every key the
   * registry does not answer for, so nothing here reaches `VerifiedToken.header`
   * — the domain surface exists so a caller never learns the wire's vocabulary,
   * and an unregistered wire param has no domain name to learn.
   *
   * ⚠ THE BAG HAS A NULL PROTOTYPE at runtime (`Object.create(null)`), because its
   * keys come off a token a stranger wrote: `__proto__` is a legal member name on
   * both wires, and only a null-prototype target can hold it as an own key instead
   * of letting it choose the bag's prototype. A CALLER observes the difference —
   * `bag.hasOwnProperty(k)` and `bag.toString()` throw, `bag instanceof Object` is
   * `false`, and `util.inspect` prints `[Object: null prototype]`. Use
   * `Object.hasOwn(bag, k)` and `Object.keys(bag)`, which is what a bag of
   * attacker-chosen keys wants anyway.
   */
  custom: { header: Record<string, unknown> };
};

/**
 * The two header BUCKETS a COSE kit result reports, kept apart (RFC 9052 §3).
 *
 * Merging the two into one header makes an unsigned parameter indistinguishable
 * from a signed one, so anything reading the result decides policy on a value the
 * PRESENTER could have written. Reporting them separately means a reader has to
 * name the bucket it trusts.
 */
export type CoseHeaderBuckets = {
  /** The INTEGRITY-PROTECTED header — the only bucket a signature or AEAD covers. */
  protectedHeader: WireTokenHeader;
  /**
   * The UNAUTHENTICATED header bucket: present on the wire, covered by nothing.
   * Nothing read from here may decide whether a token is accepted; the advisory
   * `kid` routing hint rides here (RFC 9052 §3.1), which is the reason the bucket
   * is surfaced at all.
   *
   * `Partial` because an unprotected bucket has no required member — not even
   * `alg`, which {@link WireTokenHeader} requires.
   */
  unprotectedHeader: Partial<WireTokenHeader>;
  /**
   * The params NO registry row answers for, PER BUCKET, VERBATIM as the issuer
   * wrote them — the read half of {@link CoseWireTokenEnvelope}'s `custom` bag.
   * Same typed-bag, tier-boundary and null-prototype rules as
   * {@link JoseHeaderBuckets.custom}; two buckets here because COSE has two.
   *
   * ⚠ THE KEY TYPE IS EXACT; THE VALUE TYPE IS `unknown` FOR A REASON. A COSE
   * producer may nest a CBOR map inside a custom parameter, and the decoder hands
   * that back as a `Map` — so `CwtKit`/`CwsKit`/`CweKit` can report a value here
   * that its JOSE twin reports as a plain object for the same logical input.
   * Neither is converted: a read reports what the producer wrote, in the shape the
   * wire carries it, and normalising one into the other would invent a structure
   * on one wire or destroy label fidelity on the other — a COSE label may be an
   * integer, which an object key cannot hold (RFC 9052 §1.5). A consumer reading a
   * custom value must therefore branch on the shape, exactly as it would reading the raw
   * wire — which is what this bag is.
   * pinned: `internal/header/custom-header-params.read.test.ts#a nested CBOR map
   * survives as a Map, and its JOSE twin as a plain object`.
   */
  custom: {
    protected: Record<string, unknown>;
    unprotected: Record<string, unknown>;
  };
};
