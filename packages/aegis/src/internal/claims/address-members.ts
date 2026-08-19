import type { ClaimMemberSpec } from "../registry/claim-spec.js";
import type { Wire } from "../registry/wire.js";
import { type WireKey, wireName } from "../registry/wire-key.js";

/**
 * The members of the OIDC Core §5.1.1 `address` claim — the first member set the
 * claim registry declares, and the thing that replaced a blanket `snakeKeys` /
 * `camelKeys` over whatever a caller happened to supply.
 *
 * SIX of the seven are OIDC Core §5.1.1's own, quoted from the specification
 * text: `formatted`, `street_address`, `locality`, `region`, `postal_code`,
 * `country`. §5.1.1 states the shape of all six in one sentence — *"All the
 * address values defined below are represented as JSON strings"* — which is why
 * every member below carries `codec: { kind: "text" }`.
 *
 * ⚠ THE SEVENTH, `careOf`, IS A LINDORM EXTENSION AND IS DECLARED AS ONE. It is
 * NOT an OIDC Core §5.1.1 member. It reached the wire as `care_of` for as long as
 * the blanket case flip existed, with nothing anywhere recording that it is ours
 * rather than the specification's — which is precisely the kind of fact a
 * declaration exists to hold. A reader of a lindorm token who looks `care_of` up
 * in OIDC Core will not find it, and that is now stated here rather than
 * discovered there.
 *
 * ⚠ THE SET IS OPEN (`open: "flip"` on the claim's codec — see
 * `claims-registry.ts`), so a member declared here is NOT an allowlist. An
 * undeclared member is still carried, and `"flip"` is the cell that says under
 * WHICH spelling: the mechanical snake_case key every unregistered claim gets,
 * because an undeclared address member is a lindorm extension of a lindorm type
 * and the house convention is the right one for it. (The sibling value,
 * `"verbatim"`, is for a structure whose undeclared fields are named by somebody
 * else — an RFC 9396 authorization-details element.) What the declaration buys
 * is what could not be said before: each member's spelling ON EACH WIRE, its
 * value shape, its empty form, and a sample the generated conformance suite can
 * round-trip.
 */

/**
 * Both wires spell an address member the same way.
 *
 * RFC 8392 assigns integer CWT labels to CLAIMS, not to the members inside one,
 * and no COSE registry names the OIDC address members — so the COSE spelling of
 * a member is the JOSE spelling, and a COSE address map is text-keyed inside.
 * (The `address` CLAIM itself is a different question and is answered by the
 * registry entry: it carries a lindorm private-use integer label, which the
 * interoperable default degrades to the string key `address`.)
 */
const sameOnBothWires = (name: string): Record<Wire, WireKey> => ({
  jose: wireName(name),
  cose: wireName(name),
});

/**
 * Every member is `whenEmpty: "keep"`.
 *
 * ⚠ It is the verdict that reproduces today's behaviour EXACTLY — the blanket
 * flip carried an empty member onto the wire — and reproducing it is deliberate.
 * §5.1.1 makes OMISSION the way to say a field is unavailable (*"Implementations
 * MAY return only a subset of the fields of an address"*), which is an argument
 * that an empty member says nothing and should prune. That argument is a
 * public-surface semantic change of the same family as closing the member set,
 * it applies to every structured claim rather than to this one, and it is filed
 * as an open question rather than taken here.
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
 * `classes/Aegis.spec-matrix.test.ts`), so deriving it here puts EVERY declared
 * member through a real mint and a real verify, on every wire the claim runs on.
 * A hand-written claim sample naming three of the seven members — which is what
 * stood here — could only ever exercise the three somebody remembered.
 */
export const ADDRESS_SAMPLE: Readonly<Record<string, unknown>> = Object.fromEntries(
  ADDRESS_MEMBERS.map((member) => [member.domain, member.sample]),
);
