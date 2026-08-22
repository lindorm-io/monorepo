/**
 * The ONE shared base both parameter registries are built on
 * (`internal/header/header-registry.ts`, `internal/claims/claims-registry.ts`),
 * so a column exists for every parameter or for none.
 */

import type { SpecCitation } from "./spec-citation.js";
import type { Wire } from "./wire.js";
import type { WireKey } from "./wire-key.js";

/**
 * The ONLY input to the aegis confidentiality gate: a `"sensitive"` parameter may
 * be published only on an encrypted token. ⚠ A fact about the PARAMETER — a
 * caller cannot declassify it by routing the value through another container.
 */
export type Sensitivity = "public" | "sensitive";

/**
 * Each registry supplies its OWN closed union of kinds (`ClaimCodec`,
 * `HeaderCodec`) rather than one widened union, so both translators keep an
 * exhaustive `switch` with a `never` default.
 */
export type ValueCodec = { kind: string };

/** A codec plus its optional PER-WIRE overrides. */
export type WireCodec<C extends ValueCodec> = C & { per?: Partial<Record<Wire, C>> };

/**
 * The WIDEST verdict any registry may pass on an EMPTY value ({@link
 * ParamSpec.whenEmpty}). A registry narrows it: {@link ClaimSpec} takes
 * `"keep" | "prune"`, so `refuse` is a HEADER verdict and the compiler says so.
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
   * How the value is shaped; `per` overrides the base codec on one wire. The byte
   * encodings are indistinguishable at the type level, so only the derived drift
   * guard in `internal/claims/claims-registry.test.ts` notices one flipping.
   */
  codec: WireCodec<C>;
  sensitivity: Sensitivity;
  /**
   * What the emission-boundary prune does to an EMPTY value (`""`, `null`, `[]`,
   * `{}` — `0`, `false` and a zero-length Buffer are values). REQUIRED with no
   * default: each verdict fails open in a different direction.
   *   - `"prune"`  the empty value is indistinguishable from "not stated".
   *   - `"keep"`   the empty value is a STATEMENT; dropping it changes meaning.
   *   - `"refuse"` the empty value cannot be honoured, so the emission boundary
   *                throws (`internal/header/refuse-empty-headers.ts`).
   *
   * ⚠ TOP-LEVEL and WRITE SIDE ONLY (`internal/utils/normalise-claims.ts`,
   * `internal/header/normalise-headers.ts`). A read reports what a producer WROTE.
   *
   * ⚠ It guarantees every bag crossing a NORMALISATION, not every byte on the
   * wire: `mergeCoseProtected` writes `alg`/`typ`/`cty` into the label map behind
   * a bare `!== undefined`, bypassing this column.
   *
   * ⚠ A MEMBER's own cell ({@link MemberSpec}) answers a different question. This
   * one is read about the WHOLE parameter
   * (`internal/claims/prune-empty-claims.ts`); a member's by the structure walker
   * about that member alone (`internal/claims/translate.ts`).
   */
  whenEmpty: E;
  /**
   * WHICH RULE governs this parameter, and where to read it
   * ({@link SpecCitation}). REQUIRED with no default: the `policy` arm is how an
   * entry says "lindorm's own rule" out loud rather than leaving the cell absent.
   *
   * ⚠ ONE section. A parameter whose two wires are defined by different documents
   * cites the JOSE-side one — `tokenId` is RFC 7519 §4.1.7, while COSE spells the
   * same claim `cti` (RFC 8392 §3.1.7). The divergence is data in
   * {@link ParamSpec.wire}.
   */
  spec: SpecCitation;
  /**
   * A representative DOMAIN-shaped value. REQUIRED, so a new parameter cannot be
   * added without giving the generated conformance suite something to round-trip.
   * The principal consumer is `classes/Aegis.spec-matrix.test.ts`; find the rest
   * with `grep -rn "\.sample\b" src --include="*.ts"`.
   */
  sample: D;
};

/**
 * A MEMBER of a parameter whose codec declares a structure. ⚠ An `Omit`, not a
 * copy, so a new base column is a compile error in every member. The one omission
 * is {@link ParamSpec.sensitivity}: the confidentiality gate filters TOP-LEVEL
 * specs (`internal/utils/extract-sensitive-claims.ts`), and a per-member gate
 * would be a new capability.
 *
 * ⚠ `jwk` and `epk` declare no children: a JWK is a union discriminated by `kty`
 * (`internal/cose/cose-key.ts` branches EC/OKP/AKP, and the AKP `pub` label -1 is
 * the EC `crv` label -1), which a flat member set cannot express.
 *
 * ⚠ A MEMBER INHERITS `codec: WireCodec<C>` AND NOTHING READS A PER-WIRE OVERRIDE
 * ON ONE — {@link codecFor} is the only reader and is only ever handed a
 * TOP-LEVEL spec; the structure walkers read `member.codec` directly. The fix is
 * to route the walkers through {@link codecFor}, not to fork the type.
 */
export type MemberSpec<
  D = unknown,
  C extends ValueCodec = ValueCodec,
  E extends WhenEmpty = WhenEmpty,
> = Omit<ParamSpec<D, C, E>, "sensitivity"> & {
  /**
   * MANDATORY whenever the structure carrying it is present; absent ⇒ optional.
   *
   * ⚠ A SHAPE FACT, NOT A PROFILE POLICY — it holds under every profile and under
   * none, so the structure walker enforces it wherever the claim is translated
   * (`internal/claims/translate.ts`).
   *
   * ⚠ IT REFUSES IN BOTH DIRECTIONS, unlike {@link ParamSpec.whenEmpty} (write
   * side only): a structure missing a required member has nothing to report it AS
   * (RFC 9396 §2), so neither dropping nor keeping it describes the producer.
   *
   * ⚠ IT DEMANDS A SATISFIED VALUE, not mere presence — `isClaimSatisfied`, the
   * same predicate a profile `required` rule reads.
   */
  required?: true;
};

/**
 * The two columns that IDENTIFY a parameter. Both {@link ParamSpec} and
 * {@link MemberSpec} carry them, so one wire-name selector serves either.
 */
export type WireNamed = Pick<ParamSpec, "domain" | "wire">;

/** The codec that applies on a given wire: the per-wire override, else the base. */
export const codecFor = <C extends ValueCodec>(
  spec: { codec: WireCodec<C> },
  wire: Wire,
): C => spec.codec.per?.[wire] ?? spec.codec;
