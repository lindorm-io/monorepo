/**
 * The ONE shared base both parameter registries are built on: the header
 * registry (`internal/header/header-registry.ts`) and the claim registry
 * (`internal/claims/claims-registry.ts`).
 *
 * They were two DIFFERENT shapes describing the same kind of thing — a named
 * parameter with a wire spelling, a value shape and an emptiness verdict — which
 * is why a fact stated on one side (the claim registry's sensitivity mark) was
 * never consulted by the code that needed it. One base means a column exists for
 * every parameter or for none.
 *
 * TWO honest deltas, and only two:
 *   1. `placement` / `critEligible` are meaningless for a CLAIM (a claim has no
 *      protected/unprotected bucket and is never a critical header parameter), so
 *      they live on {@link HeaderSpec} alone.
 *   2. `temporal` / `bucket` / `domainClaim` are meaningless for a HEADER
 *      parameter, so they live on the claim spec alone.
 *
 * ⚠ There was a THIRD, and it was not a delta but a duplicate: a `Registry<S>`
 * wrapper declaring `unregistered: "drop" | "passthrough"`. Nothing read it. The
 * policy it named is written in the code that performs it — `translate.ts` writes
 * every unconsumed key into `custom`, `token-header.ts` drops one in both
 * directions — so the column was a second source of truth for a rule already
 * stated once, and its only two readers asserted the literal against itself.
 *
 * ⚠ {@link ParamSpec.whenEmpty} is NOT a delta and never was. It was declared on
 * the claim spec alone while the header registry emitted an empty value straight
 * onto the wire with nothing recorded about it; once both registries answer the
 * question, declaring it twice on two siblings is exactly the drift this base
 * exists to prevent.
 */

import type { SpecCitation } from "./spec-citation.js";
import type { Wire } from "./wire.js";
import type { WireKey } from "./wire-key.js";

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
   * ⚠ THE COLUMN NOW EXISTS AT TWO LEVELS, AND THEY ANSWER DIFFERENT QUESTIONS.
   * A parameter whose codec is `{ kind: "object", children }` declares its inner
   * members, and each member answers `whenEmpty` for itself
   * ({@link MemberSpec}). The two are not the same verdict one level apart:
   *   - THIS cell is read at the EMISSION BOUNDARY
   *     (`internal/claims/prune-empty-claims.ts`), about the WHOLE parameter —
   *     `address: {}` says nothing, so `address` is `"prune"`.
   *   - A MEMBER's cell is read by the TRANSLATOR as it walks the structure
   *     (`internal/claims/translate.ts`), about that member alone — whether
   *     `street_address: ""` is a statement the issuer made or noise the caller
   *     left behind.
   * A parameter the registry does NOT give children (every scalar, and the
   * `jwk`/`epk` header parameters) still has no inner structure to recurse into,
   * and nothing recurses for it.
   *
   * ⚠ WRITE SIDE ONLY, on both registries. The prune decides what AEGIS EMITS;
   * a read reports what a producer WROTE, and rewriting a foreign token's empty
   * value into an absence would make aegis misreport it.
   *
   * ⚠ BOTH registries answer this. A claim and a header parameter each have an
   * empty form, and each has to say whether that form is a statement or noise.
   * What differs between the two registries — a key with NO entry at all is
   * dropped on the header side and carried into `custom` on the claim side — is
   * stated by the code that performs it (`token-header.ts`, `translate.ts`) and
   * by nothing here. That the header set is CLOSED narrows how many parameters
   * can ask this question; it does not answer it for any of them.
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
   * spelling. A prose citation could only ever be checked by a human reading it,
   * which is how 32 wrong ones accumulated here.
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
   * added without giving the generated conformance suite something to round-trip
   * — which is what stops a new parameter from dodging coverage entirely.
   *
   * ⚠ WHO BREAKS WHEN A SAMPLE IS WRONG, named so the question is checkable in
   * one hop. Derived with `grep -rn "\.sample\b" src --include="*.ts"`:
   *   - `classes/Aegis.spec-matrix.test.ts` — the PRINCIPAL consumer, and the one
   *     the column was written for. Paired with `__fixtures__/spec-dispositions.ts`,
   *     it supplies this value at the parameter's named public door and requires
   *     it back under the parameter's DOMAIN name. Two samples have been caught
   *     broken by it.
   *   - `__fixtures__/run-policy-exercise.ts` — the META matrix builds its claim
   *     bag out of every claim's sample, so a sample that fails its own claim's
   *     policy rule fails there instead.
   *   - `internal/header/wire-parity.test.ts` — carries the sample through a
   *     synthesised parity spec.
   *   - the two registry self-tests, which bind each sample to its codec KIND
   *     rather than merely requiring it to be defined.
   */
  sample: D;
};

/**
 * A MEMBER of a parameter whose codec declares a structure — the same six
 * columns a top-level parameter answers, MINUS ONE.
 *
 * ⚠ IT IS AN `Omit`, NOT A COPY, and that is the point. Writing the six columns
 * out again would be a second source of truth for the shared base: a column
 * added there would silently not exist here, which is the drift the base was
 * created to remove. Derived, a new base column is a compile error in every
 * member the same way it is in every parameter.
 *
 * THE ONE OMISSION IS {@link ParamSpec.sensitivity}. The aegis confidentiality
 * gate filters TOP-LEVEL specs (`internal/claims/extract-sensitive-claims.ts`);
 * a per-member gate would have to split a structure in half on the way to the
 * wire and is a NEW CAPABILITY, not a restatement of an existing one.
 *
 * ⚠ NOT EVERY STRUCTURED PARAMETER CAN HAVE CHILDREN, and the two that cannot
 * are on the HEADER side: `jwk` and `epk` are JWKs, and a JWK is a union
 * DISCRIMINATED BY `kty` — `internal/cose/cose-key.ts` branches EC/OKP/AKP with
 * different member sets, and the AKP `pub` label (-1) is the EC `crv` label (-1)
 * under a different `kty`. A flat member set cannot express that, so declaring
 * one would be inventing a shape rather than recording one. They stay
 * `{ kind: "jwk" }`.
 *
 * ⚠ A MEMBER INHERITS `codec: WireCodec<C>`, SO IT CAN DECLARE A PER-WIRE
 * OVERRIDE AND NOTHING READS IT. {@link codecFor} is the only reader, and its one
 * production caller (`internal/cose/cwt-spec.ts`'s `fieldForClaim`) is handed a
 * TOP-LEVEL spec; the structure walkers read `member.codec` directly. So a member
 * declaring `per: { cose: … }` would be a cell with no consumer — the exact shape
 * this sweep deleted four columns for. It is recorded rather than narrowed
 * because narrowing means splitting the base `codec` cell in two, which
 * reintroduces the drift the shared base exists to prevent; the fix when a member
 * genuinely needs a per-wire codec is to route the walkers through
 * {@link codecFor}, not to fork the type. No member declares one today
 * (`grep -c "per:" internal/claims/*-members.ts` → 0).
 */
export type MemberSpec<
  D = unknown,
  C extends ValueCodec = ValueCodec,
  E extends WhenEmpty = WhenEmpty,
> = Omit<ParamSpec<D, C, E>, "sensitivity"> & {
  /**
   * An RFC makes this member MANDATORY whenever the structure carrying it is
   * present (RFC 9396 §2 `authorization_details[].type`; RFC 9493 §3
   * `sub_id.format`, at the claim AND inside every element of its
   * `identifiers` array). Absent ⇒ optional.
   *
   * ⚠ IT IS A SHAPE FACT, NOT A PROFILE POLICY, and that is the whole reason it
   * is a registry column. It holds under EVERY profile and under none, so the
   * structure walker enforces it wherever the claim is translated
   * (`internal/claims/translate.ts`) — where the equivalent profile `shape`
   * rule it replaced defended only the profiles that opted in. A shape rule the
   * caller can decline is not a statement about the structure; it is a
   * statement about one profile's appetite.
   *
   * ⚠ IT REFUSES IN BOTH DIRECTIONS, unlike {@link ParamSpec.whenEmpty} (write
   * side only). `whenEmpty` decides what aegis EMITS, and a read must report
   * what a producer wrote — but "report it" is exactly what a structure with no
   * required member cannot be given: RFC 9396 §2 makes `type` the field whose
   * value "determines the allowable contents of the object that contains it",
   * so an element without one has no defined contents to report. Dropping it on
   * read would misreport a stranger's token (fewer authorizations than it
   * states); keeping it would hand a consumer an authorization nobody defined.
   * The third disposition is the only honest one, and it is a refusal.
   *
   * ⚠ IT DEMANDS A SATISFIED VALUE, not mere presence — `isClaimSatisfied`, the
   * same predicate a profile `required` rule reads. An `authorization_details`
   * element typed `""` identifies no type, so nothing can be looked up to
   * interpret the rest of it. On the WRITE side a `whenEmpty: "prune"` member
   * is dropped by the prune first and then refused as absent; on the READ side
   * the prune does not run, so the empty value reaches this check itself. One
   * predicate, both directions, same outcome.
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
