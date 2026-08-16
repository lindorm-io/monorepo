import type { Dict } from "@lindorm/types";
import { omitUndefined } from "@lindorm/utils";
import { pruneEmptyHeaders } from "./prune-empty-headers.js";

/**
 * The single normalisation applied to a header bag on the way to the wire —
 * shared by JOSE and COSE so both wires behave identically, and the twin of
 * `internal/utils/normalise-claims.ts`. TWO strips, neither of them a choice:
 *
 *   1. `undefined`, recursively. It is the one value with no semantic ambiguity:
 *      the absent property of a bag assembled from optional fields, on every
 *      wire, for every caller. Nobody writes `undefined` to mean something.
 *   2. The empty value of a parameter whose registry entry says that empty value
 *      carries nothing ({@link pruneEmptyHeaders}). Per PARAMETER, top level
 *      only; a key the registry does not know is never touched.
 *
 * ⚠ THE REGISTRY DECIDES, NOT THE CALLER, exactly as on the claim side. Whether
 * an empty value is a statement or noise is a fact about the PARAMETER: an empty
 * `cty` is not a media type but a second spelling of "none stated" — and one
 * `serialiseContent` prefers over the inferred type, so a sealed object came back
 * a Buffer — while an empty `x5t#S256` is an unsatisfiable certificate binding
 * that must be REFUSED by the verifier rather than pruned into no binding at all.
 * One cell each, stated once, for everyone.
 *
 * ⚠ A PARAMETER THAT EMITS NOTHING IS NOT A PARAMETER. That is the rule the two
 * builders already applied to `undefined` in both directions and on both wires;
 * normalising the caller's bag ONCE, at the top of each builder, widens "emits
 * nothing" from `undefined` to "`undefined`, or empty where the registry says
 * prune" — one rule, both wires, every guard. Nothing that emits bytes stops
 * being guarded: a `keep` cell survives normalisation, so `x5t#S256` still
 * reaches the reserved, duplicate and placement checks with its value intact.
 *
 * ⚠ IT KNOWS NOTHING ABOUT `crit`, and must not. A parameter a message's `crit`
 * names cannot be empty by the time a normalisation runs, because the builders
 * REFUSE that header outright (`assert-crit-satisfied.ts`): a producer stating
 * that a recipient must understand a parameter, while giving it nothing to
 * understand, is a contradiction named at the point it is made. So there is no
 * referent for a prune to leave dangling and no exemption to scope. The exemption
 * that used to live here had to be told which bag, which bucket, which tier and
 * which vocabulary it applied to; refusing the contradiction instead deletes all
 * four questions rather than answering them.
 *
 * ⚠ WRITE SIDE ONLY. `parseTokenHeader` does NOT normalise, and the collision
 * that settles it is `crit`: the read side DEFAULTS `critical` to `[]` because
 * `DomainTokenHeader.critical` is non-optional, so a read-side prune would delete
 * the value the parser just wrote. Beyond that, a read must report what a
 * producer WROTE — a foreign `cty: ""` reported as absent is aegis misreporting
 * someone else's header — and the read side's own guards (`validate-crit.ts`,
 * `JweKit.decrypt`'s `zip` refusal, `verify-cert-binding.ts`) fire on exactly the
 * evidence a prune would have deleted.
 *
 * ⚠ IDEMPOTENT, and it has to be, because a bag crosses this TWICE by design. The
 * reason is that SOME DOORS READ THE CALLER'S BAG BEFORE THE HEADER IS ASSEMBLED —
 * `serialiseContent(data, callerHeader.cty)` decides the payload's serialisation
 * and, through the wire `cty`, its reconstruction — so a normalisation at the
 * emission boundary alone would be too late for the one parameter that matters
 * most. The doors that READ THE BAG BEFORE THE BUILDER DOES therefore normalise it
 * first — four of the seven public write doors, plus the domain crossing:
 *
 *   - the OPAQUE-CONTENT doors (`JwsKit.sign`, `JweKit.encrypt`, `CwsKit.sign`,
 *     `CweKit.encrypt`), which read `header.cty` off a caller's WIRE-named bag to
 *     pick the payload serialisation;
 *   - `mapTokenHeader`, which is where a caller's DOMAIN-named bag arrives.
 *
 * ⚠ THE OTHER THREE DOORS NEED NO CALL, and that is a fact about their PAYLOAD
 * rather than an omission — it is also the sentence that says when they stop being
 * exempt. `JwtKit.sign` and `CwtKit`/`CwmKit` (through `signCwt`) hand
 * `options.header` straight to the builder because a CLAIMS payload has a fixed
 * serialisation — JSON by RFC 7519 §3, CBOR by RFC 8392 §7.2 — so they read
 * nothing off the caller's bag, and the builder's own normalisation is early
 * enough for every use they make of it. Give one of them a payload-shaping step
 * that CONSULTS the caller's header, and that door owes a call at the door on the
 * same day, for the reason the four above have one.
 *
 * The emission boundaries (`shapeWireHeader` / `wireHeaderToCoseMap`) then
 * normalise again, which is the second, redundant application. All of them consult
 * the same registry cell through the same JOSE-name lookup, so they cannot
 * disagree — stated here rather than defended at each of the call sites.
 *
 * ⚠ THAT IS ALSO WHAT KEEPS THE TWO WIRES SAYING THE SAME THING. The kit-DERIVED
 * `cty` is written to the JOSE header through a normalising tier but straight into
 * the COSE label map (`mergeCoseProtected`, behind a bare `!== undefined`), so an
 * empty derived value would be pruned on one wire and emitted as `[3, ""]` on the
 * other. It cannot be empty because the door removed the only thing that made it
 * so — the fix is upstream of both, not a second rule at the COSE write.
 */
export const normaliseHeaders = <T extends Dict = Dict>(dict: T): T =>
  pruneEmptyHeaders(omitUndefined(dict));
