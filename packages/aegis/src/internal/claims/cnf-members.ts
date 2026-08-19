import type { SpecCitation } from "../registry/spec-citation.js";
import type { Wire } from "../registry/wire.js";
import { type WireKey, wireAbsent, wireLabel, wireName } from "../registry/wire-key.js";

/**
 * ⭐ THE ONE DECLARATION OF THE RFC 7800 CONFIRMATION MEMBERS — what each one is
 * called in the domain vocabulary, what it is called on each wire, and what shape
 * its value has.
 *
 * ⚠⚠ IT REPLACES FIVE HAND-KEPT COPIES OF THE SAME FIVE MEMBERS, every one of
 * which could disagree with the others silently:
 *   1. `internal/claims/translate.ts`'s `confirmationToWire` — the domain -> JOSE
 *      member table (write).
 *   2. the same file's `toConfirmation` — the JOSE -> domain table (read).
 *   3. `internal/utils/rules/cnf-shape.ts`'s `PERMITTED_MEMBERS` — the DOMAIN
 *      spellings, as a mint-side allow list.
 *   4. `internal/registry/kit-capabilities.ts`'s `JOSE_CNF` — the WIRE spellings,
 *      as the JOSE kits' capability row.
 *   5. `internal/registry/cose-cnf-labels.ts`'s `COSE_CNF_LABELS` — the two COSE
 *      labels, plus a `CnfMember` union written out a sixth time in
 *      `internal/registry/capabilities.ts`.
 * All five are DERIVED from this table now, so a member added here reaches the
 * translator, the mint-side shape rule, both capability rows and the COSE codec
 * at once, and a member that is not here reaches none of them.
 *
 * ⛔⛔ IT IS DELIBERATELY **NOT** `ObjectCodec.children`, AND THE REASON IS
 * DURABLE RATHER THAN A DEFERRAL. Five structured claims migrated onto the
 * registry's generic member sets (`address`, `authorization_details`, `act` /
 * `may_act`, `sub_id`); `cnf` is the one that cannot, for the same kind of reason
 * `events` cannot, and it is worth stating precisely because the migration was
 * planned and then measured against the code:
 *
 *   1. THE COSE FORM NEEDS A PER-CLAIM BUILDER, WHICH IS WHAT `bespoke` MEANS.
 *      RFC 8747 §3.1 carries the embedded key as a COSE_Key (label 1), so the
 *      member's VALUE is transcoded — a JWK becomes an integer-labelled CBOR map
 *      — while every declared member set the registry walks carries its values
 *      through unchanged. `internal/cose/cose-key.ts` does that transcoding, and
 *      it cannot be derived from a member set because a JWK is a union
 *      DISCRIMINATED BY `kty` whose labels COLLIDE — TWO collisions, not one:
 *      `AKP.pub` is -1 where `EC`/`OKP` put `crv`, and `AKP.priv` is -2 where they
 *      put `x` (`internal/cose/cose-key.ts`). A flat member set cannot express a
 *      label whose meaning depends on a sibling's value.
 *      ⚠ The header registry's `jwk`/`epk` are NOT a precedent for this, though
 *      an earlier version of this note cited them as one: `HeaderCodec` has no
 *      `object` arm and no `children` field at all, so those parameters were never
 *      able to have children and nothing was declined for them. The `kty`
 *      collision stands on its own.
 *   2. THE COSE cnf MAP IS A **REGISTERED** LABEL MAP. `internal/cose/cwt-spec.ts`'s
 *      `shapeForObject` emits a derived label map only under `proprietary: true`,
 *      because the labels it was built for (`act`'s `client_id` 4 and `act` 5) are
 *      lindorm's own. RFC 8747 §3.1's labels are IANA-registered and must ride on
 *      every COSE token, interoperable or not — a distinction the derived shaper
 *      has no cell for and would have to gain one for a single claim.
 *   3. THE REFUSAL BELONGS TO THE BYTE LAYER, SO THE `absent` CELLS MUST BE READ
 *      THERE. The raw `aegis.cwt.sign` door hands an already-wire `CwtClaimsWire`
 *      straight to `CwtKit.sign` with no translation at all
 *      (`internal/cose/cwt-spec.ts`), so a translator-side refusal for a member
 *      COSE cannot carry would be a SECOND copy of the byte layer's rather than a
 *      replacement for it — and two places refusing one thing is the drift this
 *      registry exists to remove. This table is read by the byte layer directly,
 *      which is what lets the cells stay `absent` and still have a reader.
 *      ⚠ A supporting fact, stated accurately because an earlier version of this
 *      note overstated it: the generic walker cannot key an `absent` member as it
 *      stands — `walkObject` calls `direction.keyOf(member)` eagerly for every
 *      member and both selectors route through `claims-registry.ts`'s
 *      `requireName`, which THROWS for a wire with no name. That is "it would need
 *      a new selector variant and a stated disposition", not "it cannot be
 *      expressed" — `wireKeyName` returns `string | undefined` perfectly happily.
 *      The reason above is the one that decides it.
 *
 * ⇒ What the migration was FOR — one declaration instead of five — is delivered
 * here. What it could not deliver is the generic codec, and `bespoke` is the
 * registry's word for exactly that.
 *
 * ⚠⚠ THE MEMBER SET IS **OPEN**, AND RFC 7800 IS WHY. This was planned as the
 * registry's first CLOSED set and the specification reverses it outright. §3.1:
 * "The 'cnf' claim is used in the JWT to contain members used to identify the
 * proof-of-possession key.  Other members of the 'cnf' object may be defined
 * because a proof-of-possession key may not be the only means of confirming the
 * authenticity of the token." And, in the same section: "The set of confirmation
 * members that a JWT must contain to be considered valid is context dependent and
 * is outside the scope of this specification.  Specific applications of JWTs will
 * require implementations to understand and process some confirmation members in
 * particular ways.  However, in the absence of such requirements, all confirmation
 * members that are not understood by implementations MUST be ignored." A refusal
 * would violate that MUST directly.
 *
 * ⚠ AND THE REGISTRY IS OPEN BY CONSTRUCTION. §3.1 continues: "This specification
 * establishes the IANA 'JWT Confirmation Methods' registry for these members in
 * Section 6.2 and registers the members defined by this specification.  Other
 * specifications can register other members used for confirmation, including
 * other members for conveying proof-of-possession keys using different key
 * representations." Two of the five below were registered by exactly that route —
 * `jkt` by RFC 9449 §6.1 and `x5t#S256` by RFC 8705 §3.1 — and §6.2.2's own
 * initial contents name a FOURTH member aegis does not carry, `jwe` (§3.3,
 * "Encrypted JSON Web Key"). So a closed set would have refused a member RFC 7800
 * itself defines.
 *
 * ⚠ THE TAIL RIDES VERBATIM, never case-flipped. A tail member is another
 * specification's registered confirmation-method name — §6.2.1 makes the name
 * "case sensitive" — so the house snake_case flip would not translate it but
 * rewrite it into a member nobody is looking for. Same reason the RFC 8693 actor
 * chain carries a verbatim tail.
 *
 * ⚠ `ckt` IS NOT HERE, and that is not an omission. RFC 9679 §5.6 registers a
 * COSE Key Thumbprint confirmation method; aegis derives none and mints none. It
 * is named in {@link CnfMember} so the capability union can describe COSE
 * honestly, and it is in no kit's set.
 */

/**
 * One confirmation member.
 *
 * FOUR columns, each with a reader:
 *   - `domain`  the aegis spelling, and the key `ConfirmationClaim` carries.
 *   - `spec`    WHICH RULE governs the member ({@link SpecCitation}), read by
 *               `internal/registry/spec-citations.test.ts` against the committed
 *               corpus. ⚠ It is stated HERE rather than inherited, because this
 *               type is NOT {@link MemberSpec} — a confirmation member has no
 *               codec, no `whenEmpty` and no sample, so it shares the question
 *               but not the base. The two cells cannot drift apart silently: the
 *               same test iterates both registries.
 *   - `wire`    TOTAL over {@link Wire}, exactly as a registry entry is: a new
 *               wire is a compile error in every member rather than a silent hole.
 *               The COSE cell is a {@link WireKey}, so "COSE cannot carry this"
 *               is a STATED FACT with its reason attached rather than a member
 *               missing from a label table.
 *   - `value`   the value shape, which is what both directions guard on. `"jwk"`
 *               is an object aegis does not describe further (see the file
 *               docstring); `"text"` is a string.
 */
export type CnfMemberSpec = {
  domain: string;
  spec: SpecCitation;
  /**
   * ⚠ TOTAL over {@link Wire} through the `Record`, AND narrowed on JOSE through
   * the intersection. Both halves are load-bearing: the `Record` is what makes a
   * third wire a compile error in every member, and the JOSE narrowing is what
   * says a confirmation method ALWAYS has a JOSE spelling — the members come from
   * the IANA "JWT Confirmation Methods" registry (RFC 7800 §6.2), so a member with
   * no JOSE name is not a confirmation method. It is also what lets
   * {@link CnfMember} be derived from the names rather than restated.
   */
  wire: Record<Wire, WireKey> & { jose: { kind: "name"; name: string } };
  value: "text" | "jwk";
};

/**
 * ⚠ WHY THE THREE COSE CELLS ARE `absent` RATHER THAN UNLABELLED NAMES. RFC 9679
 * §5.5 declines to register "a CWT confirmation method [RFC8747] for using 'jkt'
 * as a confirmation method for a CWT", so there is no label a JWK thumbprint may
 * travel under; the COSE thumbprint that does exist (`ckt`, §5.6) digests the
 * key's canonical CBOR while RFC 7638 digests its canonical JSON, so the same key
 * yields DIFFERENT bytes and relabelling one as the other would mislabel the
 * digest. `x5t#S256` and `jku` have no RFC 8747 registration at all. A member with
 * no COSE form is not the same thing as a member COSE keys by its string name —
 * `acr` is the latter — and `wireAbsent` is what keeps the two apart.
 */
const NO_COSE_JKT =
  "RFC 9679 §5.5 declines to register a CWT confirmation method for `jkt`; the COSE thumbprint `ckt` digests the key's canonical CBOR where RFC 7638 digests its canonical JSON, so the same key yields different bytes and one cannot be relabelled as the other.";
const NO_COSE_X5T =
  "RFC 8747 registers no COSE confirmation method for an X.509 certificate thumbprint; `x5t#S256` (RFC 8705 §3.1) is a JOSE confirmation member only.";
const NO_COSE_JKU =
  "RFC 8747 registers no COSE confirmation method for a JWK Set URL; `jku` (RFC 7800 §3.5) is a JOSE confirmation member only.";

export const CNF_MEMBERS = [
  {
    // RFC 9449 §6.1 — the base64url SHA-256 JWK thumbprint (RFC 7638) of the key
    // a DPoP-bound token is bound to.
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
    // RFC 8705 §3.1 — the mTLS client certificate thumbprint.
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
    // RFC 7800 §3.2 / RFC 8747 §3.1 — the embedded public key. COSE label 1,
    // where the value is a COSE_Key rather than a JWK (`internal/cose/cose-key.ts`).
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
    // RFC 7800 §3.4 / RFC 8747 §3.1 — the key identifier. COSE label 3, carried
    // as a byte string.
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
    // RFC 7800 §3.5 — the JWK Set URL the confirmed key can be fetched from.
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
 * The RFC 7800 / RFC 8747 confirmation members aegis can put on a wire — DERIVED
 * from the table's own JOSE names, so a member cannot be admitted by a capability
 * row without being declared.
 *
 * `ckt` is added by hand and is in no kit's set: see the file docstring.
 */
export type CnfMember = (typeof CNF_MEMBERS)[number]["wire"]["jose"]["name"] | "ckt";

/**
 * The confirmation members COSE CAN carry — DERIVED by discriminating each
 * member's own `wire.cose` cell on `kind`, so "representable" and "has a label"
 * are one fact rather than two lists.
 *
 * ⭐⭐ WIDENING THIS IS A COMPILE ERROR, NOT A TEST FAILURE — and that is the
 * property the deleted `registry/cose-cnf-labels.ts` used to CLAIM ("the codec
 * switches EXHAUSTIVELY over CoseCnfMember in both directions, so adding a label
 * without an encoder AND a decoder does not compile"). It is now demonstrated
 * rather than asserted. A sabotage probe gave `x5t#S256` a COSE label —
 * `wireLabel(4, "x5t#S256")` in place of its `wireAbsent` cell — and the build
 * failed before any test ran:
 *
 *     src/internal/cose/cose-key.ts(188,36): error TS2345: Argument of type
 *     '"x5t#S256"' is not assignable to parameter of type 'never'.
 *     src/internal/cose/cose-key.ts(208,36): error TS2345: Argument of type
 *     '"x5t#S256"' is not assignable to parameter of type 'never'.
 *
 * Those two positions are `unhandledCnfMember`'s `never` parameter in the encode
 * and decode switches: a member admitted here with no arm in BOTH directions
 * narrows to something the exhaustive default cannot accept. So the label table
 * cannot grow past the codec that writes it, in that direction, without a human
 * being told.
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
 * ⚠ A member is COSE-representable IFF it has a LABEL here, which is the same
 * fact `wireAbsent` states on the three that have none. The COSE capability row
 * and the codec's own refusal both read this, so the set a caller is told is
 * representable and the set the encoder writes are one thing.
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
