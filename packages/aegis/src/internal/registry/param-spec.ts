/**
 * The ONE shared base both parameter registries are built on: the header
 * registry (`internal/header/header-registry.ts`) and the claim registry
 * (`internal/claims/claims-registry.ts`). One base means a column exists for
 * every parameter or for none.
 *
 * TWO honest deltas, and only two:
 *   1. `placement` / `critEligible` are meaningless for a CLAIM (a claim has no
 *      protected/unprotected bucket and is never a critical header parameter),
 *      so they live on {@link HeaderSpec} alone.
 *   2. `temporal` / `bucket` / `domainClaim` are meaningless for a HEADER
 *      parameter, so they live on {@link ClaimSpec} alone.
 */

import type { SpecCitation } from "./spec-citation.js";
import type { Wire } from "./wire.js";
import type { WireKey } from "./wire-key.js";

/**
 * The ONLY input to the aegis confidentiality gate. A `"sensitive"` parameter
 * may be published only on an encrypted token; `"public"` is unconditional.
 *
 * ⚠ It is a fact about the PARAMETER, never derived from which container a
 * caller routed the value through — a caller cannot declassify by re-routing.
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
   * How the value is shaped. `per` overrides the base codec on one wire. The
   * case that exists today is JOSE-text/COSE-bytes: the token id (`jti`/`cti`)
   * and the three OIDC hashes. Which claims carry an override, and which byte
   * encoding each one declares, is frozen by a derived drift guard in
   * `internal/claims/claims-registry.test.ts` — the two encodings are
   * indistinguishable at the type level, so nothing but that guard would notice
   * one flipping.
   */
  codec: WireCodec<C>;
  sensitivity: Sensitivity;
  /**
   * What the emission-boundary prune does to this parameter when its value is
   * EMPTY (`""`, `null`, `[]`, `{}` — `0`, `false` and a zero-length Buffer are
   * values and never empty). REQUIRED, with no default: each verdict fails open
   * in a different direction, so there is nothing safe to fall into.
   *   - `"prune"`  the empty value is indistinguishable from "not stated".
   *   - `"keep"`   the empty value is a STATEMENT: dropping it either broadens
   *                what the token permits (a restriction, a binding) or erases
   *                what the token is FOR (the event, its subject).
   *   - `"refuse"` the empty value is a statement that CANNOT BE HONOURED, so
   *                neither disposal is a token anyone asked for. The emission
   *                boundary THROWS instead, at the one point the value is still
   *                in the producer's hands
   *                (`internal/header/refuse-empty-headers.ts`).
   *
   * ⚠ `"refuse"` is a HEADER verdict and the TYPE says so — {@link ClaimSpec}
   * instantiates this base at `"keep" | "prune"` and carries the reasoning.
   * `"keep"` has no header user; `header-registry.ts` states what a header
   * parameter would have to be for the cell to fit.
   *
   * ⚠ TOP-LEVEL and WRITE SIDE ONLY. Where the prune runs this column is the
   * only thing consulted — there is no per-call mode
   * (`internal/utils/normalise-claims.ts`, `internal/header/normalise-headers.ts`).
   * A read reports what a producer WROTE, so rewriting a foreign token's empty
   * value into an absence would make aegis misreport it.
   *
   * ⚠ IT IS A GUARANTEE ABOUT EVERY BAG THAT CROSSES A NORMALISATION, NOT ABOUT
   * EVERY BYTE ON THE WIRE. The kit-DERIVED COSE header tier bypasses it —
   * `mergeCoseProtected` writes `alg`/`typ`/`cty` straight into the label map
   * behind a bare `!== undefined` — and what makes that safe is the values, not
   * this column: see `internal/header/normalise-headers.ts`.
   *
   * ⚠ THE COLUMN EXISTS AT TWO LEVELS AND THEY ANSWER DIFFERENT QUESTIONS. A
   * parameter whose codec is `{ kind: "object", children }` has members that each
   * answer `whenEmpty` for themselves ({@link MemberSpec}):
   *   - THIS cell is read at the EMISSION BOUNDARY
   *     (`internal/claims/prune-empty-claims.ts`) about the WHOLE parameter —
   *     `address: {}` says nothing, so `address` is `"prune"`.
   *   - A MEMBER's cell is read by the TRANSLATOR as it walks the structure
   *     (`internal/claims/translate.ts`) about that member alone — whether
   *     `street_address: ""` is a statement the issuer made or noise.
   */
  whenEmpty: E;
  /**
   * WHICH RULE governs this parameter, and where to read it
   * ({@link SpecCitation}). REQUIRED, with no default, for the same reason
   * {@link ParamSpec.whenEmpty} is: an absent cell says nobody decided, and the
   * `policy` arm is how an entry says "lindorm's own rule" out loud instead.
   *
   * ⚠ It is CHECKED, which is the whole reason it is data and not a comment.
   * `internal/registry/spec-citations.test.ts` requires every `rfc`/`oidc` cell
   * to name a section that exists in the committed corpus
   * (`src/__fixtures__/rfc/`) AND whose text contains this parameter's own wire
   * spelling — which a prose citation, checkable only by a human reading it,
   * never could be.
   *
   * ⚠ The cell names ONE section, and a parameter whose two wires are defined by
   * different documents cites the JOSE-side one — `tokenId` is RFC 7519 §4.1.7
   * (`jti`), while COSE spells the same claim `cti` (RFC 8392 §3.1.7). The
   * divergence is data in {@link ParamSpec.wire}; this cell says which rule
   * created the parameter.
   */
  spec: SpecCitation;
  /**
   * A representative DOMAIN-shaped value. REQUIRED, so a new parameter cannot be
   * added without giving the generated conformance suite something to
   * round-trip — which is what stops it from dodging coverage entirely.
   *
   * The principal consumer is `classes/Aegis.spec-matrix.test.ts`, which supplies
   * this value at the parameter's named public door and requires it back under
   * the parameter's DOMAIN name. Find the rest with
   * `grep -rn "\.sample\b" src --include="*.ts"`.
   */
  sample: D;
};

/**
 * A MEMBER of a parameter whose codec declares a structure — the same columns a
 * top-level parameter answers, MINUS ONE.
 *
 * ⚠ IT IS AN `Omit`, NOT A COPY. Written out again it would be a second source
 * of truth for the shared base: a column added there would silently not exist
 * here. Derived, a new base column is a compile error in every member.
 *
 * THE ONE OMISSION IS {@link ParamSpec.sensitivity}. The confidentiality gate
 * filters TOP-LEVEL specs (`internal/claims/extract-sensitive-claims.ts`); a
 * per-member gate would have to split a structure in half on the way to the wire
 * and is a NEW CAPABILITY, not a restatement of an existing one.
 *
 * ⚠ NOT EVERY STRUCTURED PARAMETER CAN HAVE CHILDREN, and the two that cannot
 * are on the HEADER side: `jwk` and `epk` are JWKs, and a JWK is a union
 * DISCRIMINATED BY `kty` — `internal/cose/cose-key.ts` branches EC/OKP/AKP with
 * different member sets, and the AKP `pub` label (-1) is the EC `crv` label (-1)
 * under a different `kty`. A flat member set cannot express that, so declaring
 * one would invent a shape rather than record one. They stay `{ kind: "jwk" }`.
 *
 * ⚠ A MEMBER INHERITS `codec: WireCodec<C>`, SO IT CAN DECLARE A PER-WIRE
 * OVERRIDE AND NOTHING READS IT. {@link codecFor} is the only reader and its one
 * production caller (`internal/cose/cwt-spec.ts`'s `fieldForClaim`) is handed a
 * TOP-LEVEL spec; the structure walkers read `member.codec` directly. ⇒ The fix
 * when a member genuinely needs a per-wire codec is to route the walkers through
 * {@link codecFor}, NOT to fork the type — narrowing means splitting the base
 * `codec` cell in two, which reintroduces the drift the shared base prevents.
 * None declares one today (`grep -c "per:" internal/claims/*-members.ts` -> 0).
 */
export type MemberSpec<
  D = unknown,
  C extends ValueCodec = ValueCodec,
  E extends WhenEmpty = WhenEmpty,
> = Omit<ParamSpec<D, C, E>, "sensitivity"> & {
  /**
   * An RFC makes this member MANDATORY whenever the structure carrying it is
   * present. Absent ⇒ optional.
   *
   * ⚠ IT IS A SHAPE FACT, NOT A PROFILE POLICY, which is why it is a registry
   * column: it holds under EVERY profile and under none, so the structure walker
   * enforces it wherever the claim is translated
   * (`internal/claims/translate.ts`). A shape rule the caller can decline is not
   * a statement about the structure but about one profile's appetite.
   *
   * ⚠ IT REFUSES IN BOTH DIRECTIONS, unlike {@link ParamSpec.whenEmpty} (write
   * side only). A read must report what a producer wrote — but a structure with
   * no required member has nothing to report it AS: RFC 9396 §2 makes `type` the
   * field whose value "determines the allowable contents of the object that
   * contains it", so an element without one has no defined contents. Dropping it
   * would misreport a stranger's token (fewer authorizations than it states);
   * keeping it would hand a consumer an authorization nobody defined.
   *
   * ⚠ IT DEMANDS A SATISFIED VALUE, not mere presence — `isClaimSatisfied`, the
   * same predicate a profile `required` rule reads. On the WRITE side a
   * `whenEmpty: "prune"` member is dropped by the prune first and then refused as
   * absent; on the READ side the prune does not run, so the empty value reaches
   * this check itself. One predicate, both directions, same outcome.
   */
  required?: true;
};

/**
 * The two columns that IDENTIFY a parameter — its domain name and its per-wire
 * spelling. Both {@link ParamSpec} and {@link MemberSpec} carry them, which is
 * what lets one wire-name selector serve a claim and a member alike.
 */
export type WireNamed = Pick<ParamSpec, "domain" | "wire">;

/** The codec that applies on a given wire: the per-wire override, else the base. */
export const codecFor = <C extends ValueCodec>(
  spec: { codec: WireCodec<C> },
  wire: Wire,
): C => spec.codec.per?.[wire] ?? spec.codec;
