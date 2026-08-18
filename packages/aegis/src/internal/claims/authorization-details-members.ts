import type { ClaimMemberSpec } from "../registry/claim-spec.js";
import { wireName } from "../registry/wire-key.js";

/**
 * The members of ONE RFC 9396 `authorization_details` element — the first
 * member set the claim registry declares for a COLLECTION rather than for a
 * single structure, and the first one with a MANDATORY member.
 *
 * ⭐ EXACTLY ONE MEMBER IS DECLARED, AND THAT IS THE SPECIFICATION'S OWN SHAPE.
 * RFC 9396 §2 defines the element by a single field and then hands the rest of
 * it away, verbatim (no markup added inside the quote):
 *
 *   type:  An identifier for the authorization details type as a string.
 *      The value of the type field determines the allowable contents of
 *      the object that contains it.  The value is unique for the
 *      described API in the context of the AS.  This field is REQUIRED.
 *
 * So `type` is the one thing every element must carry and the one thing that
 * means the same to everybody; everything beside it means whatever the API that
 * registered that `type` says it means.
 *
 * ⚠ THE FIVE COMMON DATA FIELDS ARE DELIBERATELY NOT DECLARED. RFC 9396 §2.2
 * does name `locations`, `actions`, `datatypes`, `identifier` and `privileges`
 * with shapes — but it introduces them as fields it "does not require the use
 * of ... by an API definition but, instead, provides them as reusable generic
 * components", and says in the same paragraph that "The allowable values of all
 * fields are determined by the API being protected, as defined by a particular
 * `type` value." Declaring a shape for them would not record a fact; it would
 * create a REFUSAL the specification does not ask for. A declared member whose
 * value fails its own codec is dropped by the walker (that is what stops aegis
 * signing what it could not read back), so a deployment sending `locations` in
 * some type-specific form would silently lose it — where today it rides. The
 * five reach the wire through the open tail below, untouched, which is both
 * what happens now and what the RFC describes.
 *
 * ⚠ THE OPEN TAIL IS `"verbatim"`, AND THIS CLAIM IS WHY THE CELL HAS TWO
 * VALUES. An element's remaining fields are named by whoever registered its
 * `type`, and RFC 9396's own Figure 2 names them `instructedAmount`,
 * `creditorName` and `creditorAccount`. The mechanical snake_case flip an
 * `address` member takes would rewrite those into fields no resource server
 * reads — the same corruption the `events` map is carried verbatim to avoid.
 */
export const AUTHORIZATION_DETAIL_MEMBERS: ReadonlyArray<ClaimMemberSpec> = [
  {
    domain: "type",
    /**
     * Both wires spell it `type`. RFC 8392 assigns integer CWT labels to
     * CLAIMS, not to the fields inside one, and no COSE registry names the RAR
     * element fields — so a COSE authorization-details element is text-keyed
     * inside, exactly as the JOSE one is.
     */
    wire: { jose: wireName("type"), cose: wireName("type") },
    codec: { kind: "text" },
    /**
     * ⚠ INERT WHILE `required` HOLDS, and stated as inert rather than dressed up
     * as a decision. `required` is on this same member and demands a SATISFIED
     * value, so `walkObject` refuses `type: ""` whichever verdict this cell
     * carries: measured, flipping it to `"keep"` leaves the whole suite green,
     * the corpus byte-identical and every door's answer unchanged. It is
     * declared because {@link ParamSpec.whenEmpty} is REQUIRED on every member
     * and there is nothing safe to default to — not because anything reads it
     * here. `"prune"` is the honest one of the two: an empty type identifies
     * nothing that could be looked up, so it is not a statement worth carrying.
     * ⇒ A member that ever drops `required` gets a live cell back, and must
     * decide it then.
     */
    whenEmpty: "prune",
    required: true,
    sample: "payment_initiation",
  },
];

/**
 * The `authorizationDetails` claim's own `sample` column, DERIVED from the
 * member set rather than written beside it — the same binding
 * `ADDRESS_MEMBERS` gives the `address` claim, and for the same reason: it is
 * what puts every declared member through the generated conformance matrix's
 * real mint and real verify (`__fixtures__/spec-dispositions.ts` +
 * `classes/Aegis.spec-matrix.test.ts`).
 *
 * ONE element, because the claim's shape is proven by the element and its
 * cardinality is not a registry fact — RFC 9396 §2 says only that an
 * "authorization_details array MAY contain multiple entries of the same type".
 */
export const AUTHORIZATION_DETAILS_SAMPLE: ReadonlyArray<Record<string, unknown>> = [
  Object.fromEntries(
    AUTHORIZATION_DETAIL_MEMBERS.map((member) => [member.domain, member.sample]),
  ),
];
