import type { ClaimMemberSpec } from "../registry/claim-spec.js";
import type { Wire } from "../registry/wire.js";
import { type WireKey, wireName } from "../registry/wire-key.js";

/**
 * The members of the OIDC Core §5.1.1 `address` claim.
 *
 * SIX of the seven are OIDC Core §5.1.1's own — `formatted`, `street_address`,
 * `locality`, `region`, `postal_code`, `country` — and all six are strings there,
 * which is why every member below carries `codec: { kind: "text" }`.
 *
 * ⚠ THE SEVENTH, `careOf`, IS A LINDORM EXTENSION AND IS DECLARED AS ONE — a
 * reader who looks `care_of` up in OIDC Core §5.1.1 will not find it.
 *
 * ⚠ THE SET IS OPEN (`open: "flip"` on the claim's codec, see
 * `claims-registry.ts`), so a member declared here is NOT an allowlist: an
 * undeclared member still rides, under the mechanical snake_case key every
 * unregistered claim gets, because an undeclared address member is a lindorm
 * extension of a lindorm type. (The sibling value `"verbatim"` is for a structure
 * whose undeclared fields are named by somebody else — an RFC 9396
 * authorization-details element.)
 */

/**
 * Both wires spell an address member the same way: RFC 8392 §4 labels CLAIMS, not
 * the members inside one, and no COSE registry names the OIDC address members —
 * so a COSE address map is text-keyed inside. (The `address` CLAIM itself carries
 * a lindorm private-use label; see its registry entry.)
 */
const sameOnBothWires = (name: string): Record<Wire, WireKey> => ({
  jose: wireName(name),
  cose: wireName(name),
});

/**
 * Every member is `whenEmpty: "keep"` — an empty member rides.
 *
 * ⚠ OIDC Core §5.1.1 is an argument for `"prune"` instead. That is a
 * public-surface semantic change applying to every structured claim rather than
 * to this one, and it is filed as an open question rather than taken here.
 */
const KEEP = "keep" as const;

export const ADDRESS_MEMBERS: ReadonlyArray<ClaimMemberSpec> = [
  {
    domain: "formatted",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1.1",
    },
    wire: sameOnBothWires("formatted"),
    codec: { kind: "text" },
    whenEmpty: KEEP,
    sample: "Sample 1\n00100 Stockholm\nSweden",
  },
  {
    domain: "streetAddress",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1.1",
    },
    wire: sameOnBothWires("street_address"),
    codec: { kind: "text" },
    whenEmpty: KEEP,
    sample: "Sample 1",
  },
  {
    domain: "locality",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1.1",
    },
    wire: sameOnBothWires("locality"),
    codec: { kind: "text" },
    whenEmpty: KEEP,
    sample: "Stockholm",
  },
  {
    domain: "region",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1.1",
    },
    wire: sameOnBothWires("region"),
    codec: { kind: "text" },
    whenEmpty: KEEP,
    sample: "Stockholm",
  },
  {
    domain: "postalCode",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1.1",
    },
    wire: sameOnBothWires("postal_code"),
    codec: { kind: "text" },
    whenEmpty: KEEP,
    sample: "00100",
  },
  {
    domain: "country",
    spec: {
      kind: "oidc",
      doc: "OIDC Core",
      section: "5.1.1",
      url: "https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.1.1",
    },
    wire: sameOnBothWires("country"),
    codec: { kind: "text" },
    whenEmpty: KEEP,
    sample: "SE",
  },
  // --- lindorm extension, NOT an OIDC Core §5.1.1 member ---------------------
  {
    domain: "careOf",
    spec: {
      kind: "policy",
      why: "a lindorm extension of the OIDC address structure; no specification defines a `care_of` address member.",
    },
    wire: sameOnBothWires("care_of"),
    codec: { kind: "text" },
    whenEmpty: KEEP,
    sample: "Sample Recipient",
  },
];

/**
 * The `address` claim's own `sample` column (`internal/registry/param-spec.ts`),
 * DERIVED from the members rather than written beside them.
 *
 * ⭐ THIS IS WHAT GIVES A MEMBER'S `sample` A CONSUMER. The claim sample is what
 * the generated conformance matrix supplies at the claim's named public door and
 * requires back under its domain name (`__fixtures__/spec-dispositions.ts` +
 * `classes/Aegis.spec-matrix.test.ts`), so deriving it puts EVERY declared member
 * through a real mint and a real verify; a hand-written one exercises only the
 * members somebody remembered.
 */
export const ADDRESS_SAMPLE: Readonly<Record<string, unknown>> = Object.fromEntries(
  ADDRESS_MEMBERS.map((member) => [member.domain, member.sample]),
);
