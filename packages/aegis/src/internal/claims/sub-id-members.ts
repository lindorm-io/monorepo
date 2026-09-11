import type { ClaimMemberSpec } from "../registry/claim-spec.js";
import type { Wire } from "../registry/wire.js";
import { type WireKey, wireLabel, wireName } from "../registry/wire-key.js";
import { SUBJECT_IDENTIFIER_REQUIRED_MEMBERS } from "./sub-id.js";

/**
 * The members of an RFC 9493 `sub_id` Subject Identifier.
 *
 * ⭐ `identifiers` IS THE ARRAY-OF-SELF (RFC 9493 §3.2.8) — the member set names
 * itself through the COLLECTION arm, which is why `ObjectCodec.children` is a
 * thunk and why this claim is the only one reaching `walkElements`, the CWT
 * shaper's `StructureForm: "collection"` and `CompactSpec.nested.array`.
 *
 * ⚠ THE SET IS OPEN (`open: "verbatim"`, on the claim's codec AND on the element
 * codec below) BECAUSE AEGIS IS NOT THE AUTHORITY ON ANY FORMAT — RFC 9493 §3
 * lets a format be named without registration, so a closed set would refuse a
 * conformant token. `"verbatim"` and not `"flip"`: a tail member is named by
 * whoever registered the format, so the house snake_case flip would rewrite it
 * rather than translate it. (`address` takes `"flip"` — an undeclared address
 * member is a lindorm extension of a lindorm type.)
 *
 * ⚠⚠ SO A DECLARED MEMBER IS CAMEL IN THE DOMAIN AND SNAKE ON THE WIRE, WHILE AN
 * UNDECLARED ONE IS WHATEVER THE PRODUCER WROTE — `phoneNumber` reaches the wire
 * as `phone_number`, an undeclared `given_name` as `given_name`. ⇒ A caller who
 * writes the WIRE spelling of a DECLARED member is REFUSED for the collision
 * rather than resolved by key order (`internal/claims/translate.ts`).
 */

/**
 * How a Subject Identifier member is keyed on each wire: the RFC 9493 name on
 * JOSE, an INTEGER label on COSE with that name as the interoperable string
 * fallback — so the compact and interoperable COSE forms are two renderings of
 * ONE declaration.
 *
 * ⚠⚠ ONLY `iss` (1) AND `sub` (2) ARE REGISTERED ANYWHERE (RFC 8392 §4); `format`
 * (0) and everything from 4 up are LINDORM's own, meaningful only to a verifier
 * holding this registry, which is why they ride in the proprietary encoding alone.
 *
 * ⚠ LABEL 3 IS DELIBERATELY UNALLOCATED — RFC 8392 §4 gives it to `aud`, so the
 * gap holds 1/2/3 to their CWT meanings in every lindorm-compact structure. Above
 * 3 this table and the compact ACTOR table are private-use and PER-STRUCTURE (4 is
 * `email` here and `client_id` in `act-members.ts`). ⛔ Renumbering to close the
 * gap moves bytes on every signed proprietary token and buys nothing.
 */
const subIdMember = (name: string, label: number): Record<Wire, WireKey> => ({
  jose: wireName(name),
  cose: wireLabel(label, name),
});

/**
 * Every member but `format` is `whenEmpty: "keep"` — an empty member rides.
 *
 * ⚠ Whether it SHOULD is per FORMAT, not per member (RFC 9493 §3.2.2), and
 * `internal/utils/rules/sub-id-shape.ts` is what answers it: a format's required
 * members are read through `isClaimSatisfied`, so `email: ""` is refused there
 * while the walker still carries it for the formats that do not demand it.
 */
const KEEP = "keep" as const;

/** The `aliases` format, named once — it is both a sample value and a filter. */
const ALIASES = "aliases";

export const SUB_ID_MEMBERS: ReadonlyArray<ClaimMemberSpec> = [
  {
    /**
     * ⭐ THE ONE UNCONDITIONALLY MANDATORY MEMBER (RFC 9493 §3), so it is a
     * {@link ClaimMemberSpec.required} cell rather than a row in the per-format
     * table — the walker enforces it in both directions and under every profile,
     * where the profile `shape` rule only defends the one profile that names it.
     */
    domain: "format",
    spec: {
      kind: "rfc",
      rfc: "RFC 9493",
      section: "3",
      url: "https://www.rfc-editor.org/rfc/rfc9493#section-3",
    },
    wire: subIdMember("format", 0),
    codec: { kind: "text" },
    /**
     * ⚠ INERT WHILE `required` HOLDS — the same cell, for the same reason, as
     * `authorization-details-members.ts`'s `type`: `required` demands a SATISFIED
     * value, so `walkObject` refuses `format: ""` whichever verdict sits here.
     */
    whenEmpty: "prune",
    required: true,
    sample: ALIASES,
  },
  {
    // RFC 9493 §3.2.3 — the `iss_sub` format's issuer.
    domain: "issuer",
    spec: {
      kind: "rfc",
      rfc: "RFC 9493",
      section: "3.2.3",
      url: "https://www.rfc-editor.org/rfc/rfc9493#section-3.2.3",
    },
    wire: subIdMember("iss", 1),
    codec: { kind: "text" },
    whenEmpty: KEEP,
    sample: "https://idp.lindorm.test",
  },
  {
    // RFC 9493 §3.2.3 — the `iss_sub` format's subject.
    domain: "subject",
    spec: {
      kind: "rfc",
      rfc: "RFC 9493",
      section: "3.2.3",
      url: "https://www.rfc-editor.org/rfc/rfc9493#section-3.2.3",
    },
    wire: subIdMember("sub", 2),
    codec: { kind: "text" },
    whenEmpty: KEEP,
    sample: "subject_sample",
  },
  {
    // RFC 9493 §3.2.2, RFC 5322 §3.4.1.
    domain: "email",
    spec: {
      kind: "rfc",
      rfc: "RFC 9493",
      section: "3.2.2",
      url: "https://www.rfc-editor.org/rfc/rfc9493#section-3.2.2",
    },
    wire: subIdMember("email", 4),
    codec: { kind: "text" },
    whenEmpty: KEEP,
    sample: "subject.sample@lindorm.test",
  },
  {
    // RFC 9493 §3.2.5.
    //
    // ⚠ The DOMAIN spelling is camelCase like every other domain key; only the
    // `wire` cell below keeps `phone_number`.
    domain: "phoneNumber",
    spec: {
      kind: "rfc",
      rfc: "RFC 9493",
      section: "3.2.5",
      url: "https://www.rfc-editor.org/rfc/rfc9493#section-3.2.5",
    },
    wire: subIdMember("phone_number", 5),
    codec: { kind: "text" },
    whenEmpty: KEEP,
    sample: "+46700000000",
  },
  {
    // RFC 9493 §3.2.1 (Account, RFC 7565) and RFC 9493 §3.2.7 (URI) — ONE member,
    // two formats, which is why the per-format requirement table
    // (`internal/claims/sub-id.ts`) cannot fold into a member set.
    domain: "uri",
    spec: {
      kind: "rfc",
      rfc: "RFC 9493",
      section: "3.2.1",
      url: "https://www.rfc-editor.org/rfc/rfc9493#section-3.2.1",
    },
    wire: subIdMember("uri", 6),
    codec: { kind: "text" },
    whenEmpty: KEEP,
    sample: "acct:subject_sample@lindorm.test",
  },
  {
    // RFC 9493 §3.2.6.
    domain: "url",
    spec: {
      kind: "rfc",
      rfc: "RFC 9493",
      section: "3.2.6",
      url: "https://www.rfc-editor.org/rfc/rfc9493#section-3.2.6",
    },
    wire: subIdMember("url", 7),
    codec: { kind: "text" },
    whenEmpty: KEEP,
    sample: "did:example:subject_sample",
  },
  {
    // RFC 9493 §3.2.4.
    domain: "id",
    spec: {
      kind: "rfc",
      rfc: "RFC 9493",
      section: "3.2.4",
      url: "https://www.rfc-editor.org/rfc/rfc9493#section-3.2.4",
    },
    wire: subIdMember("id", 8),
    codec: { kind: "text" },
    whenEmpty: KEEP,
    sample: "subject_sample",
  },
  {
    /** ⭐⭐ THE ARRAY OF SELF — see the file docstring. */
    domain: "identifiers",
    spec: {
      kind: "rfc",
      rfc: "RFC 9493",
      section: "3.2.8",
      url: "https://www.rfc-editor.org/rfc/rfc9493#section-3.2.8",
    },
    wire: subIdMember("identifiers", 9),
    /**
     * ⚠⚠ `open` IS DECLARED ON THE ELEMENT TOO, AND OMITTING IT WOULD BE A LIVE
     * DEFECT. `open` sits on the CODEC and the element's codec is its own, so
     * stating it only on the claim leaves the Subject Identifier open at the top
     * and CLOSED inside every alias — an aliased identifier is the same kind of
     * object as the outer one (RFC 9493 §3.2.8), so a rule that changes with
     * depth is a rule about nothing. `act-members.ts` carries the same cell.
     */
    codec: {
      kind: "array",
      of: { kind: "object", children: () => SUB_ID_MEMBERS, open: "verbatim" },
    },
    whenEmpty: KEEP,
    /**
     * Hand-written and deliberately SHALLOW — the one place a self-referential
     * declaration has to stop. Its only consumer is the registry's codec
     * self-test; {@link SUB_ID_SAMPLE} below is what the conformance matrix
     * round-trips.
     */
    sample: [{ format: "opaque", id: "subject_sample" }],
  },
];

/** Each member's own sample, keyed by DOMAIN name — derived, never restated. */
const MEMBER_SAMPLES: ReadonlyMap<string, unknown> = new Map(
  SUB_ID_MEMBERS.map((member) => [member.domain, member.sample]),
);

/**
 * ONE conformant Subject Identifier of ONE format, built from the member samples
 * and the format's own requirement row.
 *
 * ⭐ IT IS WHAT BINDS THE TWO TABLES: a format naming a member `SUB_ID_MEMBERS`
 * does not declare produces an `undefined` value here, which the registry's own
 * sample check refuses.
 */
const identifierOf = (
  format: string,
  samples: ReadonlyMap<string, unknown>,
): Record<string, unknown> => ({
  format,
  ...Object.fromEntries(
    (SUBJECT_IDENTIFIER_REQUIRED_MEMBERS.get(format) ?? []).map((member) => [
      member,
      samples.get(member),
    ]),
  ),
});

/**
 * One identifier per registered format EXCEPT `aliases` — the exclusion is
 * RFC 9493 §3.2.8, not a convenience, so the sample bottoms out at depth 2.
 */
const ALIASED: ReadonlyArray<Record<string, unknown>> = [
  ...SUBJECT_IDENTIFIER_REQUIRED_MEMBERS.keys(),
]
  .filter((format) => format !== ALIASES)
  .map((format) => identifierOf(format, MEMBER_SAMPLES));

/**
 * The `subjectId` claim's own `sample` column, DERIVED from the members — the
 * same binding `ADDRESS_MEMBERS` and `ACT_MEMBERS` give their claims.
 *
 * ⭐ IT IS AN `aliases` IDENTIFIER, AND THAT IS THE ONLY SHAPE THAT CAN CARRY
 * EVERY MEMBER CONFORMANTLY (RFC 9493 §3): the flat one-object derivation the
 * other two structures use is unmintable here, since no format describes `email`
 * and `id` and `url` together. So every declared member still reaches the
 * generated spec matrix's real mint and real verify — at DEPTH, which makes that
 * row a proof of the recursion rather than of one flat map.
 */
export const SUB_ID_SAMPLE: Readonly<Record<string, unknown>> = identifierOf(
  ALIASES,
  new Map([...MEMBER_SAMPLES, ["identifiers", ALIASED]]),
);
