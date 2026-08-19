import type { ClaimMemberSpec } from "../registry/claim-spec.js";
import { wireName } from "../registry/wire-key.js";

/**
 * The members of ONE RFC 9396 `authorization_details` element — the first member
 * set the claim registry declares for a COLLECTION rather than a single
 * structure, and the first with a MANDATORY member.
 *
 * ⭐ EXACTLY ONE MEMBER IS DECLARED, because `type` is the one field that means
 * the same to everybody: its value determines the allowable contents of the
 * object containing it, so everything beside it means whatever the API that
 * registered that `type` says it means.
 *
 * ⚠ THE FIVE COMMON DATA FIELDS ARE NOT DECLARED — `locations`, `actions`,
 * `datatypes`, `identifier`, `privileges`. RFC 9396 §2.2 offers them as
 * "reusable generic components" whose "allowable values ... are determined by
 * the API being protected", so declaring a shape would not record a fact but
 * CREATE A REFUSAL the specification does not ask for: a declared member whose
 * value fails its own codec is dropped by the walker, so a deployment sending
 * `locations` in some type-specific form would silently lose it. Through the
 * open tail they ride untouched.
 *
 * ⚠ THE TAIL IS `"verbatim"` and this claim is why that arm exists — see
 * {@link ObjectCodec}.
 */
export const AUTHORIZATION_DETAIL_MEMBERS: ReadonlyArray<ClaimMemberSpec> = [
  {
    domain: "type",
    spec: {
      kind: "rfc",
      rfc: "RFC 9396",
      section: "2",
      url: "https://www.rfc-editor.org/rfc/rfc9396#section-2",
    },
    /**
     * Both wires spell it `type`. RFC 8392 assigns integer CWT labels to
     * CLAIMS, not to the fields inside one, and no COSE registry names the RAR
     * element fields — so a COSE authorization-details element is text-keyed
     * inside, exactly as the JOSE one is.
     */
    wire: { jose: wireName("type"), cose: wireName("type") },
    codec: { kind: "text" },
    /**
     * ⚠ INERT WHILE `required` HOLDS. `required` sits on this same member and
     * demands a SATISFIED value, so `walkObject` refuses `type: ""` whichever
     * verdict this cell carries — measured: flipping it to `"keep"` leaves the
     * suite green, the corpus byte-identical and every door's answer unchanged.
     * It is declared because {@link ParamSpec.whenEmpty} is REQUIRED on every
     * member, and `"prune"` is the honest half: an empty type identifies nothing
     * that could be looked up. ⇒ A member that ever drops `required` gets a live
     * cell back and must decide it then.
     */
    whenEmpty: "prune",
    required: true,
    sample: "payment_initiation",
  },
];

/**
 * The claim's own `sample`, DERIVED from the member set rather than written
 * beside it, so every declared member goes through the generated conformance
 * matrix's real mint and real verify (`classes/Aegis.spec-matrix.test.ts`).
 *
 * ONE element: the claim's shape is proven by the element, and its cardinality
 * is not a registry fact.
 */
export const AUTHORIZATION_DETAILS_SAMPLE: ReadonlyArray<Record<string, unknown>> = [
  Object.fromEntries(
    AUTHORIZATION_DETAIL_MEMBERS.map((member) => [member.domain, member.sample]),
  ),
];
