/**
 * The ONE shared base both parameter registries are built on: the header
 * registry (`internal/header/header-registry.ts`) and the claim registry
 * (`internal/claims/claims-registry.ts`).
 *
 * They were two DIFFERENT shapes describing the same kind of thing — a named
 * parameter with a wire spelling, a value shape and a provenance — which is why
 * a fact stated on one side (the claim registry's sensitivity mark) was never
 * consulted by the code that needed it. One base means a column exists for every
 * parameter or for none.
 *
 * THREE honest deltas, and only three:
 *   1. `placement` / `critical` are meaningless for a CLAIM (a claim has no
 *      protected/unprotected bucket and is never a critical header parameter), so
 *      they live on {@link HeaderSpec} alone.
 *   2. `temporal` / `bucket` are meaningless for a HEADER parameter, so they live
 *      on the claim spec alone.
 *   3. Headers are a CLOSED set and claims are an OPEN one. That is stated ONCE,
 *      at registry level, by {@link Registry.unregistered} — never per entry.
 */

import type { Wire } from "./wire.js";
import type { WireKey } from "./wire-key.js";

/** The two directions a parameter can flow: written at mint, read at verify. */
export type Direction = "mint" | "verify";

/** A NON-EMPTY direction list. No default — an entry states when it applies. */
export type Directions = readonly [Direction, ...Array<Direction>];

/**
 * Where a parameter's value comes from:
 *   - `"caller"`   supplied by the caller (content, claims bag, header options).
 *   - `"key"`      derived from the signing/encrypting kryptos (alg, kid, x5c…).
 *   - `"computed"` produced by aegis itself — the crypto operation (epk, iv, tag,
 *                  p2s), the mint clock (iat/nbf/exp), a generated id (jti), or a
 *                  derived hash (at_hash/c_hash/s_hash).
 *   - `"issuer"`   stamped from the platform issuer identity.
 */
export type Provenance = "caller" | "key" | "computed" | "issuer";

/**
 * The ONLY input to the aegis confidentiality gate. A `"sensitive"`
 * parameter may be published only on an encrypted token; `"public"` is
 * unconditional. It is deliberately NOT derived from which container a caller
 * routed the value through — that is the mistake this column replaces.
 */
export type Sensitivity = "public" | "sensitive";

/**
 * The base every value codec satisfies: a `kind` discriminant. Each registry
 * supplies its OWN closed union of kinds (`ClaimCodec`, `HeaderCodec`) rather
 * than sharing one widened union, so both translators keep an exhaustive
 * `switch` with a `never` default — the drift guard that catches a registry
 * entry the translator has no branch for.
 */
export type ValueCodec = { kind: string };

/** A codec plus its optional PER-WIRE overrides. */
export type WireCodec<C extends ValueCodec> = C & { per?: Partial<Record<Wire, C>> };

export type ParamSpec<D = unknown, C extends ValueCodec = ValueCodec> = {
  /** The ONLY name domain logic uses. Unique within a registry. */
  domain: string;
  /**
   * TOTAL over {@link Wire}: every parameter says what it is called on EVERY
   * wire, including "nothing, because <reason>". A new wire is a compile error in
   * every entry.
   */
  wire: Record<Wire, WireKey>;
  /**
   * How the value is shaped. `per` overrides the base codec on one wire — the
   * case that exists today is the token id, a text string on JOSE (`jti`) and a
   * byte string on COSE (`cti`).
   */
  codec: WireCodec<C>;
  provenance: Provenance;
  /** Non-empty; no default. See {@link Directions}. */
  direction: Directions;
  /** May a caller assert on this parameter through the matcher door. */
  matchable: boolean;
  sensitivity: Sensitivity;
  /**
   * A representative DOMAIN-shaped value. REQUIRED, so a new parameter cannot be
   * added without giving the generated conformance suite something to round-trip
   * — which is what stops a new parameter from dodging coverage entirely.
   */
  sample: D;
};

/**
 * A registry: its entries plus the ONE policy that separates the two — what
 * happens to a key that has no entry. Headers are CLOSED (`drop`); claims are
 * OPEN (`passthrough`, into the custom bucket).
 */
export type Registry<S> = {
  specs: ReadonlyArray<S>;
  unregistered: "drop" | "passthrough";
};

/** The codec that applies on a given wire: the per-wire override, else the base. */
export const codecFor = <C extends ValueCodec>(
  spec: { codec: WireCodec<C> },
  wire: Wire,
): C => spec.codec.per?.[wire] ?? spec.codec;
