import type { ClaimMemberSpec } from "../registry/claim-spec.js";
import { wireAbsent, wireLabel, wireName } from "../registry/wire-key.js";

/**
 * ⭐ THE ONE DECLARATION OF THE RFC 7800 CONFIRMATION MEMBERS — what each one is
 * called in the domain vocabulary, what it is called on each wire, and how its
 * value is shaped on each. The translator, both capability rows and the COSE
 * codec's label table all DERIVE from this table, so a member added here reaches
 * every one of them and a member absent from it reaches none.
 *
 * The members are the structure walker's own {@link ClaimMemberSpec}s, and the
 * confirmation row (`internal/claims/claims-registry.ts`) declares this table as
 * its `children`: the walker (`internal/claims/translate.ts`) carries the members
 * on both wires in their JOSE form, keying a member the COSE wire has no label for
 * by its JOSE name there. Two carry a COSE value codec as `per.cose` — a JWK
 * becomes an integer-labelled COSE_Key (RFC 8747 §3.1 label 1) and a key id a byte
 * string (label 3) — which the registered label shaper applies
 * (`internal/cose/registered-labels.ts`, `internal/cose/cose-key.ts`).
 *
 * ⚠⚠ THE FIVE BELOW ARE NOT AN ALLOWLIST ON JOSE, AND THEY ARE ON COSE — so a
 * `cnf` member aegis does not declare is carried on one wire and refused on the
 * other. JOSE carries it verbatim through the translator (RFC 7800 §3.1,
 * RFC 7800 §6.2); the COSE cnf is a registered label map (RFC 8747 §3.1,
 * RFC 8747 §7.2), and `encodeCnf` (`internal/cose/cose-key.ts`) reaches only
 * `jwk`/`kid` and answers `cose_cnf_unsupported` for every other PRESENT, OWN,
 * STRING-KEYED member.
 *
 * Pinned by `cose-key.test.ts`'s "a PROTOTYPE key is unrepresentable, not silently
 * skipped" and, at the public mint door, `confirmation-claim-wire.test.ts`'s "a
 * COSE mint refuses an undeclared member the JOSE wire carries untouched".
 *
 * Two of the five entered through the IANA JWT Confirmation Methods registry
 * (RFC 7800 §6.2) — RFC 9449 §6.1 and RFC 8705 §3.1 — and `jwe` (RFC 7800 §3.3)
 * is registered but not carried here.
 *
 * ⚠ THE TAIL RIDES VERBATIM, never case-flipped: a tail member is another
 * specification's registered confirmation-method name (RFC 7800 §6.2.1), so the
 * house snake_case flip would rewrite it into a member nobody is looking for.
 * Same reason the RFC 8693 actor chain carries a verbatim tail.
 *
 * ⚠ `ckt` (RFC 9679 §5.6) IS NOT HERE, and that is not an omission: aegis derives
 * none and mints none. It is named in {@link CnfMember} so the capability union
 * can describe COSE honestly, and it is in no kit's set.
 */

/**
 * ⚠ WHY THE THREE COSE CELLS ARE `absent` RATHER THAN UNLABELLED NAMES. RFC 9679
 * §5.5 · RFC 8747 §7.2.2; each cell's own reason is below. A member with no COSE
 * form is not the same thing as a member COSE keys by its string name — `acr` is
 * the latter — and `wireAbsent` is what keeps the two apart.
 */
const NO_COSE_JKT =
  "aegis gives `jkt` no COSE label: the COSE thumbprint digests a deterministically encoded COSE_Key where the JOSE one digests a canonical JSON JWK, so the same key yields different bytes and neither can be relabelled as the other. RFC 9679 §5.5, RFC 7638 §3.";
const NO_COSE_X5T =
  "The COSE cnf is a registered label map, so aegis will not invent a label for a member that has none — `x5t#S256` is carried on JOSE only. RFC 8705 §3.1, RFC 8747 §3.1.";
const NO_COSE_JKU =
  "The COSE cnf is a registered label map, so aegis will not invent a label for a member that has none — `jku` is carried on JOSE only. RFC 7800 §3.5, RFC 8747 §3.1.";

// Aegis policy at mint: an empty member names no key the presenter could prove.
// Verify accepts one as written; for the key id, RFC 7800 §3.4 and RFC 8747 §3.4
// leave its content to the application.
const REFUSE = "refuse" as const;

export const CNF_MEMBERS = [
  {
    // RFC 9449 §6.1, RFC 7638 §3 — the key a DPoP-bound token is bound to.
    domain: "thumbprint",
    spec: {
      kind: "rfc",
      rfc: "RFC 9449",
      section: "6.1",
      url: "https://www.rfc-editor.org/rfc/rfc9449#section-6.1",
    },
    wire: { jose: wireName("jkt"), cose: wireAbsent(NO_COSE_JKT) },
    codec: { kind: "text" },
    whenEmpty: REFUSE,
    sample: "jkt_sample",
  },
  {
    // RFC 8705 §3.1.
    domain: "mtlsCertThumbprint",
    spec: {
      kind: "rfc",
      rfc: "RFC 8705",
      section: "3.1",
      url: "https://www.rfc-editor.org/rfc/rfc8705#section-3.1",
    },
    wire: { jose: wireName("x5t#S256"), cose: wireAbsent(NO_COSE_X5T) },
    codec: { kind: "text" },
    whenEmpty: REFUSE,
    sample: "x5t_sample",
  },
  {
    // RFC 7800 §3.2 / RFC 8747 §3.1. ⚠ The COSE value is a COSE_Key, not a JWK —
    // `per.cose` names it, and the registered label shaper transcodes it.
    domain: "key",
    spec: {
      kind: "rfc",
      rfc: "RFC 7800",
      section: "3.2",
      url: "https://www.rfc-editor.org/rfc/rfc7800#section-3.2",
    },
    wire: { jose: wireName("jwk"), cose: wireLabel(1, "jwk") },
    codec: { kind: "jwk", per: { cose: { kind: "coseKey" } } },
    whenEmpty: REFUSE,
    sample: { kty: "EC", crv: "P-256", x: "eHNhbXBsZQ", y: "eXNhbXBsZQ" },
  },
  {
    // RFC 7800 §3.4 / RFC 8747 §3.1. ⚠ COSE carries it as a byte string — `per.cose`.
    domain: "keyId",
    spec: {
      kind: "rfc",
      rfc: "RFC 7800",
      section: "3.4",
      url: "https://www.rfc-editor.org/rfc/rfc7800#section-3.4",
    },
    wire: { jose: wireName("kid"), cose: wireLabel(3, "kid") },
    codec: { kind: "text", per: { cose: { kind: "bstr", encoding: "utf8" } } },
    whenEmpty: REFUSE,
    sample: "kid_sample",
  },
  {
    // RFC 7800 §3.5.
    domain: "jwkSetUri",
    spec: {
      kind: "rfc",
      rfc: "RFC 7800",
      section: "3.5",
      url: "https://www.rfc-editor.org/rfc/rfc7800#section-3.5",
    },
    wire: { jose: wireName("jku"), cose: wireAbsent(NO_COSE_JKU) },
    codec: { kind: "text" },
    whenEmpty: REFUSE,
    sample: "https://issuer.lindorm.test/.well-known/jwks.json",
  },
] as const satisfies ReadonlyArray<ClaimMemberSpec>;

/**
 * The confirmation members aegis can put on a wire — DERIVED from the table's own
 * JOSE names, so a member cannot be admitted by a capability row without being
 * declared. `ckt` is added by hand and is in no kit's set: see the file docstring.
 */
export type CnfMember = (typeof CNF_MEMBERS)[number]["wire"]["jose"]["name"] | "ckt";

/** Every declared member's DOMAIN name, in declaration order. */
export const CNF_DOMAIN_MEMBERS: ReadonlyArray<string> = CNF_MEMBERS.map(
  (member) => member.domain,
);

/** Every declared member's JOSE wire name — the JOSE kits' capability row. */
export const CNF_JOSE_MEMBERS: ReadonlyArray<CnfMember> = CNF_MEMBERS.map(
  (member) => member.wire.jose.name,
);

/**
 * The confirmation members COSE CAN carry — the members whose `wire.cose` cell
 * carries a label, in declaration order: the COSE kits' capability row.
 *
 * ⚠ `internal/cose/registered-labels.ts` derives the codec's label table from the
 * same cells, and `kit-capabilities.test.ts` holds the two to one set, so what a
 * caller is told is representable and what the encoder writes cannot drift apart.
 * A member given a label without a COSE codec the registered map can write is
 * refused there at import, so the table cannot grow past the codec that writes it.
 */
export const COSE_CNF_MEMBERS: ReadonlyArray<CnfMember> = CNF_MEMBERS.flatMap((member) =>
  member.wire.cose.kind === "label" ? [member.wire.jose.name] : [],
);
