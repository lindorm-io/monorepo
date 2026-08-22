import type { SpecCitation } from "../registry/spec-citation.js";
import type { Wire } from "../registry/wire.js";
import { type WireKey, wireAbsent, wireLabel, wireName } from "../registry/wire-key.js";

/**
 * ⭐ THE ONE DECLARATION OF THE RFC 7800 CONFIRMATION MEMBERS — what each one is
 * called in the domain vocabulary, what it is called on each wire, and what shape
 * its value has. The translator, `internal/utils/rules/cnf-shape.ts`, both
 * capability rows and the COSE codec all DERIVE from this table, so a member
 * added here reaches every one of them and a member absent from it reaches none.
 *
 * ⛔⛔ IT IS DELIBERATELY **NOT** `ObjectCodec.children`, and three things decide
 * that where the other five structured claims migrated onto the generic member
 * sets:
 *
 *   1. THE COSE FORM TRANSCODES ITS VALUE — a JWK becomes an integer-labelled
 *      COSE_Key (RFC 8747 §3.1 label 1) where every declared member set the
 *      registry walks carries values through unchanged. `internal/cose/cose-key.ts`
 *      does that transcoding and cannot be derived from a member set, because a
 *      JWK is a union DISCRIMINATED BY `kty` whose labels COLLIDE: `AKP.pub` is -1
 *      where `EC`/`OKP` put `crv` and `AKP.priv` is -2 where they put `x`. A flat
 *      member set cannot express a label whose meaning depends on a sibling's value.
 *   2. THE COSE cnf MAP IS A **REGISTERED** LABEL MAP. `internal/cose/cwt-spec.ts`'s
 *      `shapeForObject` emits a derived label map only under `proprietary: true`,
 *      because the labels it was built for are lindorm's own; RFC 8747 §3.1's are
 *      IANA-registered and must ride on every COSE token, interoperable or not.
 *   3. THE REFUSAL BELONGS TO THE BYTE LAYER, SO THE `absent` CELLS ARE READ
 *      THERE. The raw `aegis.cwt.sign` door hands an already-wire `CwtClaimsWire`
 *      straight to `CwtKit.sign` with no translation (`internal/cose/cwt-spec.ts`),
 *      so a translator-side refusal would be a SECOND copy of the byte layer's
 *      rather than a replacement for it. The byte layer reads this table directly,
 *      which is what lets the cells stay `absent` and still have a reader.
 *      ⚠ The generic walker also cannot key an `absent` member as it stands:
 *      `walkObject` calls `direction.keyOf(member)` eagerly and both selectors
 *      route through `claims-registry.ts`'s `requireName`, which THROWS for a wire
 *      with no name. That is a missing selector variant, not an impossibility —
 *      reason 1 is what decides it.
 *
 * ⚠⚠ THE MEMBER SET IS **OPEN** (RFC 7800 §3.1), so an unrecognised confirmation
 * member is carried rather than refused; the registry it is drawn from is open
 * too (RFC 7800 §6.2), and two of the five below entered by that route —
 * RFC 9449 §6.1 and RFC 8705 §3.1. `jwe` (RFC 7800 §3.3) is registered and aegis
 * does not carry it, which a closed set would have turned into a refusal.
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
 * One confirmation member.
 *
 * ⚠ `spec` is stated HERE rather than inherited, because this type is NOT
 * {@link MemberSpec} — a confirmation member has no codec, no `whenEmpty` and no
 * sample, so it shares the question but not the base. `wire` is TOTAL over
 * {@link Wire}, so a new wire is a compile error in every member rather than a
 * silent hole, and its COSE cell is a {@link WireKey}: "COSE cannot carry this" is
 * a stated fact with its reason attached rather than a member missing from a
 * label table.
 */
export type CnfMemberSpec = {
  domain: string;
  spec: SpecCitation;
  /**
   * ⚠ TOTAL over {@link Wire} through the `Record`, AND narrowed on JOSE through
   * the intersection. Both halves are load-bearing: the `Record` makes a third
   * wire a compile error in every member, and the JOSE narrowing says a
   * confirmation method ALWAYS has a JOSE spelling (RFC 7800 §6.2) — which is
   * what lets {@link CnfMember} be derived from the names rather than restated.
   */
  wire: Record<Wire, WireKey> & { jose: { kind: "name"; name: string } };
  value: "text" | "jwk";
};

/**
 * ⚠ WHY THE THREE COSE CELLS ARE `absent` RATHER THAN UNLABELLED NAMES. RFC 9679
 * §5.5 · RFC 8747 §7.2.2; each cell's own reason is below. A member with no COSE
 * form is not the same thing as a member COSE keys by its string name — `acr` is
 * the latter — and `wireAbsent` is what keeps the two apart.
 */
const NO_COSE_JKT =
  "aegis gives `jkt` no COSE label: the COSE thumbprint digests a deterministically encoded COSE_Key where the JOSE one digests a canonical JSON JWK, so the same key yields different bytes and neither can be relabelled as the other. RFC 9679 §5.5, RFC 7638.";
const NO_COSE_X5T =
  "The COSE cnf is a registered label map, so aegis will not invent a label for a member that has none — `x5t#S256` is carried on JOSE only. RFC 8705 §3.1, RFC 8747 §3.1.";
const NO_COSE_JKU =
  "The COSE cnf is a registered label map, so aegis will not invent a label for a member that has none — `jku` is carried on JOSE only. RFC 7800 §3.5, RFC 8747 §3.1.";

export const CNF_MEMBERS = [
  {
    // RFC 9449 §6.1, RFC 7638 — the key a DPoP-bound token is bound to.
    domain: "thumbprint",
    spec: {
      kind: "rfc",
      rfc: "RFC 9449",
      section: "6.1",
      url: "https://www.rfc-editor.org/rfc/rfc9449#section-6.1",
    },
    wire: { jose: wireName("jkt"), cose: wireAbsent(NO_COSE_JKT) },
    value: "text",
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
    value: "text",
  },
  {
    // RFC 7800 §3.2 / RFC 8747 §3.1. ⚠ The COSE value is a COSE_Key, not a JWK —
    // `internal/cose/cose-key.ts` transcodes it.
    domain: "key",
    spec: {
      kind: "rfc",
      rfc: "RFC 7800",
      section: "3.2",
      url: "https://www.rfc-editor.org/rfc/rfc7800#section-3.2",
    },
    wire: { jose: wireName("jwk"), cose: wireLabel(1, "jwk") },
    value: "jwk",
  },
  {
    // RFC 7800 §3.4 / RFC 8747 §3.1. ⚠ COSE carries it as a byte string.
    domain: "keyId",
    spec: {
      kind: "rfc",
      rfc: "RFC 7800",
      section: "3.4",
      url: "https://www.rfc-editor.org/rfc/rfc7800#section-3.4",
    },
    wire: { jose: wireName("kid"), cose: wireLabel(3, "kid") },
    value: "text",
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
    value: "text",
  },
] as const satisfies ReadonlyArray<CnfMemberSpec>;

/**
 * The confirmation members aegis can put on a wire — DERIVED from the table's own
 * JOSE names, so a member cannot be admitted by a capability row without being
 * declared. `ckt` is added by hand and is in no kit's set: see the file docstring.
 */
export type CnfMember = (typeof CNF_MEMBERS)[number]["wire"]["jose"]["name"] | "ckt";

/**
 * The confirmation members COSE CAN carry — DERIVED by discriminating each
 * member's own `wire.cose` cell on `kind`, so "representable" and "has a label"
 * are one fact rather than two lists.
 *
 * ⭐⭐ WIDENING THIS IS A COMPILE ERROR, NOT A TEST FAILURE. Giving a `wireAbsent`
 * member a label narrows `internal/cose/cose-key.ts`'s `unhandledCnfMember` calls
 * — the `never` parameter of the exhaustive default in BOTH the encode and the
 * decode switch — so the label table cannot grow past the codec that writes it.
 *
 * ⚠ THE OTHER DIRECTION IS NOT COMPILER-HELD, which is why `cnf-members.test.ts`
 * pins the table against a hand-written literal: NARROWING the set — taking a
 * label away — leaves both switches exhaustive over a smaller union and compiles
 * perfectly well.
 */
export type CoseCnfMember = Extract<
  (typeof CNF_MEMBERS)[number],
  { wire: { cose: { kind: "label" } } }
>["wire"]["jose"]["name"];

/** Every declared member's DOMAIN name, in declaration order. */
export const CNF_DOMAIN_MEMBERS: ReadonlyArray<string> = CNF_MEMBERS.map(
  (member) => member.domain,
);

/** Every declared member's JOSE wire name — the JOSE kits' capability row. */
export const CNF_JOSE_MEMBERS: ReadonlyArray<CnfMember> = CNF_MEMBERS.map(
  (member) => member.wire.jose.name,
);

/** Resolve a member by its DOMAIN name (the write direction's lookup). */
export const cnfMemberByDomain: ReadonlyMap<string, CnfMemberSpec> = new Map(
  CNF_MEMBERS.map((member) => [member.domain, member]),
);

/** Resolve a member by its JOSE wire name (the read direction's lookup). */
export const cnfMemberByJose: ReadonlyMap<string, CnfMemberSpec> = new Map(
  CNF_MEMBERS.map((member) => [member.wire.jose.name, member]),
);

/**
 * The COSE label each representable member travels under — DERIVED from the
 * `wire.cose` cells, keyed by the JOSE name the translator has already produced
 * by the time the byte layer runs.
 *
 * ⚠ The COSE capability row and the codec's own refusal both read this, so the
 * set a caller is told is representable and the set the encoder writes are one
 * thing.
 */
export const COSE_CNF_LABELS = Object.fromEntries(
  CNF_MEMBERS.flatMap((member) =>
    member.wire.cose.kind === "label"
      ? [[member.wire.jose.name, member.wire.cose.label] as const]
      : [],
  ),
) as Readonly<Record<CoseCnfMember, number>>;

/** {@link COSE_CNF_LABELS}'s keys, in declaration order, for iteration. */
export const COSE_CNF_MEMBERS: ReadonlyArray<CoseCnfMember> = CNF_MEMBERS.flatMap(
  (member) =>
    member.wire.cose.kind === "label" ? [member.wire.jose.name as CoseCnfMember] : [],
);
