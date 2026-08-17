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
 *   1. `placement` / `critEligible` are meaningless for a CLAIM (a claim has no
 *      protected/unprotected bucket and is never a critical header parameter), so
 *      they live on {@link HeaderSpec} alone.
 *   2. `temporal` / `bucket` are meaningless for a HEADER parameter, so they live
 *      on the claim spec alone.
 *   3. Headers are a CLOSED set and claims are an OPEN one. That is stated ONCE,
 *      at registry level, by {@link Registry.unregistered} — never per entry.
 *
 * ⚠ {@link ParamSpec.whenEmpty} is NOT a delta and never was. It was declared on
 * the claim spec alone while the header registry emitted an empty value straight
 * onto the wire with nothing recorded about it; once both registries answer the
 * question, declaring it twice on two siblings is exactly the drift this base
 * exists to prevent.
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

/**
 * The THREE verdicts a registry can pass on a parameter's EMPTY value — see
 * {@link ParamSpec.whenEmpty} for what each one means.
 *
 * ⚠ The union is the WIDEST answer any registry may give; a registry narrows it
 * through the third type parameter. {@link ClaimSpec} takes `"keep" | "prune"`,
 * so `refuse` is a HEADER verdict and the compiler is what says so.
 */
export type WhenEmpty = "keep" | "prune" | "refuse";

export type ParamSpec<
  D = unknown,
  C extends ValueCodec = ValueCodec,
  E extends WhenEmpty = WhenEmpty,
> = {
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
   * What the emission-boundary prune does to this parameter when its value is
   * EMPTY (`""`, `null`, `[]`, `{}` — `0` and `false` are values and are never
   * empty, and neither is a zero-length Buffer). REQUIRED, with no default: each
   * verdict fails open in a different direction, so there is nothing safe to fall
   * into and a new parameter must decide.
   *   - `"prune"`  the empty value is indistinguishable from "not stated" — a
   *                scalar with no meaningful empty form, or a descriptive
   *                attribute whose empty list says nothing anyone can act on.
   *   - `"keep"`   the empty value is a STATEMENT: dropping it either broadens
   *                what the token permits (a restriction, a binding) or erases
   *                what the token is FOR (the event, the subject of the event).
   *   - `"refuse"` the empty value is a statement that CANNOT BE HONOURED, so
   *                neither disposal is a token anyone asked for: pruning it
   *                removes a guarantee the recipient enforces, and keeping it
   *                emits a token that same recipient must reject. The emission
   *                boundary THROWS instead, at the one point the value is still
   *                in the producer's hands and can be repaired
   *                (`internal/header/refuse-empty-headers.ts`).
   *
   * ⚠ `"refuse"` is a HEADER verdict and the TYPE says so — {@link ClaimSpec}
   * instantiates this base at `"keep" | "prune"`. It is not that a claim could
   * never have an unhonourable empty form. It is that a claim reaches the
   * emission boundary having ALREADY passed a layer that can speak about it in
   * its own vocabulary — the profile floor, which refuses an empty value through
   * `isClaimSatisfied` (`internal/utils/rules/`) and throws with the claim's
   * DOMAIN name — whereas a header parameter aegis writes at assembly time has
   * no such layer above it. ⚠ The floor only covers claims a PROFILE names; a
   * claim no profile mentions is refused nowhere. {@link ClaimSpec} carries the
   * full reasoning.
   *
   * ⚠ `"keep"` has ZERO header users and eleven claim users. The union keeps it
   * for that reason and NOT as a placeholder — see the `header-registry.ts`
   * docstring for what a header parameter would have to be for the cell to fit.
   *
   * ⚠ The column governs the TOP-LEVEL parameter only, and where the prune runs it
   * is the ONLY thing that governs it: there is no per-call mode to state and
   * nothing else is consulted (`internal/utils/normalise-claims.ts`,
   * `internal/header/normalise-headers.ts`).
   *
   * ⚠ WHERE IT RUNS is every emission boundary, plus — ahead of it — every point
   * that READS a caller's bag before the emission boundary would have normalised
   * it: the claim bag at each claims door as it is serialised, and the header bag
   * at the four opaque-content kit doors (which read `cty` to pick that
   * serialisation) and at the domain crossing. The three CLAIMS doors take no
   * header call, because they read nothing off that bag;
   * `internal/header/normalise-headers.ts` states that condition and what would
   * end it. It does NOT run on the kit-DERIVED COSE
   * header tier: `mergeCoseProtected` writes `alg`/`typ`/`cty` straight into the
   * label map behind a bare `!== undefined`. What makes that safe is not this
   * column but the values: all three are COMPUTED, and the one of them a caller
   * can influence (`cty`, through `serialiseContent`) is normalised at the door
   * before the codec reads it. So the column is not a guarantee about every byte
   * on the wire — it is a guarantee about every bag that crosses a normalisation.
   *
   * A parameter's INNER members are its
   * own declared structure (RFC 9396 `actions`, an RFC 8417 event payload, an
   * OIDC `address` member, a JWK's coordinates) and aegis has not declared them,
   * so nothing recurses.
   *
   * ⚠ WRITE SIDE ONLY, on both registries. The prune decides what AEGIS EMITS;
   * a read reports what a producer WROTE, and rewriting a foreign token's empty
   * value into an absence would make aegis misreport it.
   *
   * ⚠ BOTH registries answer this. A claim and a header parameter each have an
   * empty form, and each has to say whether that form is a statement or noise.
   * What differs between the two registries is a SEPARATE column —
   * {@link Registry.unregistered}, which decides what happens to a key with no
   * entry at all. That the header set is CLOSED narrows how many parameters can
   * ask this question; it does not answer it for any of them.
   */
  whenEmpty: E;
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
