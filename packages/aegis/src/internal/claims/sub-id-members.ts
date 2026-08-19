import type { ClaimMemberSpec } from "../registry/claim-spec.js";
import type { Wire } from "../registry/wire.js";
import { type WireKey, wireLabel, wireName } from "../registry/wire-key.js";
import { SUBJECT_IDENTIFIER_REQUIRED_MEMBERS } from "./sub-id.js";

/**
 * The members of an RFC 9493 `sub_id` Subject Identifier — the member set that
 * proves the declaration mechanism recurses through an ARRAY OF ITSELF.
 *
 * ⭐ `identifiers` IS THE ARRAY-OF-SELF. RFC 9493 §3.2.8: "Subject Identifiers in
 * this format MUST contain an 'identifiers' member whose value is a JSON array
 * containing one or more Subject Identifiers." So the member's codec is
 * `{ kind: "array", of: { kind: "object", children: () => SUB_ID_MEMBERS } }` —
 * the same THUNK the RFC 8693 actor chain uses, but reached through the
 * collection arm. `act` nests ONE structure inside another; this nests MANY, and
 * the two are different paths through every walker in the package (the
 * translator's `walkElements` vs `walkObject`, the CWT shaper's
 * `StructureForm: "collection"` vs `"single"`, `CompactSpec.nested.array`).
 *
 * ⚠ THE SET IS OPEN (`open: "verbatim"`, declared on the claim's codec AND on the
 * element codec below — see the note there), AND RFC 9493 IS PRECISE ABOUT WHY.
 * §3 does NOT say a Subject Identifier may carry whatever it likes; it says the
 * opposite: "A Subject Identifier MUST NOT contain any members prohibited or not
 * described by its Identifier Format and MUST contain all members required by its
 * Identifier Format." What makes the set open is that AEGIS IS NOT THE AUTHORITY
 * ON ANY FORMAT. §3: "Every Identifier Format MUST have a unique name registered
 * in the IANA 'Security Event Identifier Formats' registry established in
 * Section 8.1 or a Collision-Resistant Name as defined in [RFC7519]", and "An
 * Identifier Format MAY describe more members than are strictly necessary to
 * identify a subject". A Collision-Resistant Name needs no registration at all,
 * so a conformant Subject Identifier can carry members no registry lists and this
 * package cannot enumerate. Refusing those would make aegis unable to read a
 * conformant token, which is the fault `act` was opened to avoid.
 *
 * ⚠ `"verbatim"`, NOT `"flip"`, for the same reason `act` and an RFC 9396
 * authorization-details element take it: a tail member is named by whoever
 * registered the FORMAT, not by lindorm, so the house snake_case flip would not
 * translate it but rewrite it into a member no receiver reads. (`address` is the
 * counter-example and takes `"flip"` — an undeclared address member is a lindorm
 * extension of a lindorm type.)
 *
 * ⚠⚠ SO A DECLARED MEMBER IS CAMEL IN THE DOMAIN AND SNAKE ON THE WIRE, WHILE AN
 * UNDECLARED ONE IS WHATEVER THE PRODUCER WROTE. `phoneNumber` reaches the wire
 * as `phone_number`; an undeclared `given_name` reaches it as `given_name`. That
 * asymmetry is real, it is the same one `authorizationDetails` carries, and it is
 * ACCEPTED rather than hidden: the alternative is either refusing conformant
 * members (a closed set) or flipping names another specification chose (`"flip"`).
 * ⇒ A caller who writes the WIRE spelling of a DECLARED member — `phone_number`
 * beside `phoneNumber` — is REFUSED for the collision rather than silently
 * resolved by key order (`internal/claims/translate.ts`).
 *
 * ⚠ THE MEMBER NAMES WERE THE WIRE'S OWN UNTIL THIS MIGRATION, and `sub_id` was
 * the only structured claim like that: the translator carried the value verbatim
 * in both directions, so `subjectId.phone_number` was a snake_case key in a
 * DOMAIN-keyed bag, and `internal/utils/rules/sub-id-shape.ts` read wire-spelled
 * members off it. Nothing declared that, and nothing chose it. The declared
 * spelling is now the house one, exactly as OIDC Core §5.1.1's `street_address`
 * is declared as `streetAddress`.
 * ⚠ `iss` AND `sub` STAY AS THEY ARE, and are NOT renamed to `issuer`/`subject`
 * the way the ACTOR members are. RFC 9493 §3.2.3 calls them MEMBERS throughout,
 * and says of their syntax alone (quoted whole, no ellipsis): "These members MUST
 * follow the formats of the "iss" member and "sub" member defined by [RFC7519],
 * respectively." — a reference to the value syntax, and the RFC's own word is
 * `member`, not `claim`. RFC 8693 §4.1 by contrast makes an actor's members
 * "claims that identify the actor" outright. They also carry no case to flip. The
 * residual divergence (`act.issuer` vs `subjectId.iss` for one wire name) is
 * recorded rather than resolved here: renaming them is a consumer-visible change
 * with no wire consequence and no RFC pressing for it.
 */

/**
 * How a Subject Identifier member is keyed on each wire.
 *
 * JOSE spells it by its RFC 9493 name. COSE keys it by an INTEGER label with that
 * name as the interoperable string fallback, so the compact and the interoperable
 * COSE forms are two renderings of ONE declaration.
 *
 * ⚠⚠ ONLY `iss` (1) AND `sub` (2) ARE REGISTERED ANYWHERE — RFC 8392 §4 assigns
 * them at CLAIM level ("iss | 1", "sub | 2") and the compact Subject Identifier
 * reuses them so it speaks the CWT vocabulary. `format` (0) and everything from 4
 * up are LINDORM's own, meaningful only to a verifier holding this registry,
 * which is exactly why they ride in the proprietary encoding alone.
 *
 * ⚠ LABEL 3 IS DELIBERATELY UNALLOCATED, and the gap is preserved rather than
 * closed. RFC 8392 §4 gives 3 to `aud`, which is not a Subject Identifier member,
 * so leaving it empty holds labels 1/2/3 to their RFC 8392 CWT meanings in EVERY
 * lindorm-compact structure. Above 3 both this table and the compact ACTOR table
 * are private-use and PER-STRUCTURE — 4 is `email` here and `client_id` there, 5
 * is `phone_number` here and `act` there — so the shared vocabulary is the
 * registered range and nothing more. Nothing recorded any of this before: the
 * labels were a hand-written table in `internal/cose/sub-id-claim.ts` whose commit
 * says only that it "reus[es] iss(1)/sub(2)", so this is the reconstruction,
 * stated as one. ⛔ Renumbering to close the gap would move bytes on every signed
 * proprietary token and buy nothing.
 */
const subIdMember = (name: string, label: number): Record<Wire, WireKey> => ({
  jose: wireName(name),
  cose: wireLabel(label, name),
});

/**
 * Every member but `format` is `whenEmpty: "keep"`.
 *
 * ⚠ It is the verdict that reproduces the passthrough EXACTLY. The translator
 * carried the caller's object verbatim, so a Subject Identifier stating
 * `email: ""` reached the wire with it, and `"keep"` is what the walker does with
 * an empty member. Whether an empty member SHOULD ride is a separate question the
 * profile shape rule already answers where it matters: RFC 9493 §3.2.2 makes the
 * `email` member of the `email` format "REQUIRED and MUST NOT be null or empty",
 * and `internal/utils/rules/sub-id-shape.ts` enforces that per format.
 */
const KEEP = "keep" as const;

/** The `aliases` format, named once — it is both a sample value and a filter. */
const ALIASES = "aliases";

export const SUB_ID_MEMBERS: ReadonlyArray<ClaimMemberSpec> = [
  {
    /**
     * ⭐ THE ONE UNCONDITIONALLY MANDATORY MEMBER, and RFC 9493 §3 says so in one
     * sentence: "A Subject Identifier MUST conform to a specific Identifier
     * Format and MUST contain a 'format' member whose value is the name of that
     * Identifier Format." It holds for EVERY format, so it is a
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
     * `authorization-details-members.ts`'s `type`. `required` demands a SATISFIED
     * value, so `walkObject` refuses `format: ""` whichever verdict sits here.
     * `"prune"` is the honest one of the two: an empty format names no Identifier
     * Format, so it resolves nothing and is not a statement worth carrying.
     */
    whenEmpty: "prune",
    required: true,
    sample: ALIASES,
  },
  {
    // RFC 9493 §3.2.3 — the `iss_sub` format's issuer.
    domain: "iss",
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
    domain: "sub",
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
    // RFC 9493 §3.2.2 — an addr-spec (RFC 5322 §3.4.1).
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
    // RFC 9493 §3.2.5 — an E.164 number "including an international dialing
    // prefix".
    //
    // ⭐ THE ONE MEMBER RULING 1 ACTUALLY MOVES. It was `phone_number` in the
    // domain bag, which is the only snake_case key any structured claim ever
    // required a caller to write. Consumer-visible break, stated as one.
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
    // RFC 9493 §3.2.1 (Account, an `acct:` URI per RFC 7565) and §3.2.7 (URI).
    // ONE member, two formats — which is why the per-format requirement table is
    // not something a member set can express.
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
    // RFC 9493 §3.2.6 — a DID URL, "and MAY be a bare DID".
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
    // RFC 9493 §3.2.4 — the Opaque format's "string with no semantics".
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
    /**
     * ⭐⭐ THE ARRAY OF SELF. See the file docstring: this member is the reason
     * the registry's member sets are thunks AND the first one to reach the
     * collection arm of every walker.
     */
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
     * DEFECT. `open` sits on the CODEC, and the element's codec is its own — so
     * stating it only on the claim would leave the Subject Identifier open at the
     * top and CLOSED inside every alias. That exact hole shipped once on `act`
     * (see `act-members.ts`), and RFC 9493 §3.2.8 makes an aliased identifier the
     * SAME kind of object as the outer one — "a JSON array containing one or more
     * Subject Identifiers" — so a rule that changes with depth is a rule about
     * nothing.
     */
    codec: {
      kind: "array",
      of: { kind: "object", children: () => SUB_ID_MEMBERS, open: "verbatim" },
    },
    whenEmpty: KEEP,
    /**
     * Hand-written and deliberately SHALLOW — the one place a self-referential
     * declaration has to stop, exactly as `act`'s own `sample` does. Its only
     * consumer is the registry's codec self-test; the CLAIM sample derived below
     * supplies the deep, per-format one the conformance matrix round-trips.
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
 * ⭐ IT IS WHAT BINDS THE TWO TABLES. `SUBJECT_IDENTIFIER_REQUIRED_MEMBERS` says
 * which members a format demands and `SUB_ID_MEMBERS` says what each member looks
 * like; a format naming a member the registry does not declare produces a sample
 * with an `undefined` value here, which the registry's own sample check refuses.
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
 * One identifier per registered format EXCEPT `aliases`.
 *
 * ⚠ The exclusion is RFC 9493 §3.2.8's own rule, not a convenience: "'aliases'
 * Subject Identifiers MUST NOT be nested, i.e., the 'identifiers' member of an
 * 'aliases' Subject Identifier MUST NOT contain a Subject Identifier in the
 * Aliases Identifier Format." So the sample bottoms out at depth 2 because the
 * specification bottoms out there.
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
 * EVERY MEMBER CONFORMANTLY. The flat derivation the other two structures use —
 * one object holding every member's sample at once — would be an RFC 9493
 * VIOLATION here: §3 says "A Subject Identifier MUST NOT contain any members
 * prohibited or not described by its Identifier Format", and no format describes
 * `email` and `id` and `url` together. The `aliases` format is the specification's
 * own answer to "several identifiers for one subject", so every declared member
 * still reaches a real mint and a real verify through the generated spec matrix —
 * at DEPTH, which is what makes that matrix row a proof of the recursion rather
 * than of one flat map.
 */
export const SUB_ID_SAMPLE: Readonly<Record<string, unknown>> = identifierOf(
  ALIASES,
  new Map([...MEMBER_SAMPLES, ["identifiers", ALIASED]]),
);
