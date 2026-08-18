import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import { encode, Tag } from "cbor2";
import MockDate from "mockdate";
import { beforeAll, describe, expect, test } from "vitest";
import { CBOR_TAG, inspectToken } from "../__fixtures__/inspect-token.js";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { Aegis } from "./Aegis.js";

/**
 * WHAT AN RFC 9493 `sub_id` SUBJECT IDENTIFIER ACTUALLY SAYS ON EACH WIRE.
 *
 * ⚠⚠ IT HAD NO INDEPENDENT PIN ON EITHER WIRE BEFORE THIS FILE. The one wire-level
 * assertion that existed (`classes/Cose.interop.test.ts`) reads the claim back
 * through `@auth0/cose` and aegis's own cbor, and everything else round-trips the
 * value through this package's own translator — which a mint bug and a read bug
 * that mirror each other satisfy exactly. The claim spent that whole time as a
 * VERBATIM passthrough (`isObject(value) ? value : undefined` in both directions),
 * so there was no member handling to get wrong; there is now.
 *
 * ⚠ EVERY ASSERTION GOES THROUGH THE INDEPENDENT INSPECTOR
 * (`__fixtures__/inspect-token.ts` — raw `cbor2` and base64url, importing nothing
 * from `src/internal/` or `src/classes/`).
 *
 * ⛔ THE SPELLINGS AND LABELS BELOW ARE WRITTEN OUT, NOT READ FROM THE REGISTRY.
 * A test deriving them from `sub-id-members.ts` agrees with whatever the registry
 * currently says — including a wrong label — so it could state that the wire
 * matches the registry but never that the wire matches RFC 9493.
 */

// Inside the fixture keys' validity window — amphora refuses an expired key.
MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

/**
 * The COSE labels the Subject Identifier MEMBERS carry, written out.
 *
 * RFC 8392 §4 registers `iss | 1` and `sub | 2` at CLAIM level, and the compact
 * Subject Identifier reuses them so it speaks the CWT vocabulary. `format` (0)
 * and 4-9 are LINDORM's own — no COSE or CWT registry names a member INSIDE a
 * claim — which is exactly why the compact form is on-platform only.
 *
 * ⚠ 3 IS ABSENT ON PURPOSE. RFC 8392 §4 gives it to `aud`, which is not a Subject
 * Identifier member, so leaving it empty holds labels 1/2/3 to their RFC 8392 CWT
 * meanings in every lindorm-compact structure. ⚠ Above 3 the tables are
 * private-use and PER-STRUCTURE and they already differ — 4 is `email` here and
 * `client_id` in the compact actor map, 5 is `phone_number` here and `act` there —
 * so the shared vocabulary is the registered range and nothing more.
 */
const FORMAT = 0;
const ISS = 1;
const SUB = 2;
const EMAIL = 4;
const PHONE_NUMBER = 5;
const URI = 6;
const URL = 7;
const ID = 8;
const IDENTIFIERS = 9;

/**
 * The lindorm private-use COSE label the `sub_id` CLAIM carries.
 *
 * RFC 8392 §9.1.1 governs a CWT CLAIM KEY — "Integer values less than -65536 are
 * marked as Private Use" — so a token carrying this is meaningless to any reader
 * but us, and an interoperable token degrades it to the string `sub_id`. The
 * CLAIM key and the MEMBER keys are different questions and are asserted apart.
 */
const SUB_ID_COSE_LABEL = -65549;

const logger = createMockLogger();

let aegis: Aegis;

beforeAll(async () => {
  const amphora = new Amphora({ internal: { issuer: ISSUER }, logger });

  await amphora.setup();
  amphora.add(TEST_EC_KEY_SIG);

  aegis = new Aegis({ amphora, logger });
});

const mint = async (
  format: "jwt" | "cwt",
  content: Dict,
  proprietary?: true,
): Promise<string> => {
  const signed = await aegis.mint(
    "default",
    { subject: "user-1", expires: "1h", ...content } as never,
    {
      format,
      proprietary,
      sign: { key: { kryptos: TEST_EC_KEY_SIG }, tokenId: "sub-id-wire-1" },
    },
  );

  return signed.token;
};

/**
 * The raw claim value a token carries, in the wire's own vocabulary.
 *
 * THROWS rather than returning `undefined` for a payload it cannot read or a
 * claim that is not there: every assertion below is an equality over this value,
 * and an equality against `undefined` that was meant to run against a structure is
 * the vacuous pass the inspector exists to prevent.
 */
const wireClaimOf = (token: string, key: number | string): unknown => {
  const inspection = inspectToken(token);

  if (inspection.payload.readable === false) {
    throw new Error(`the payload cannot be read: ${inspection.payload.reason}`);
  }

  const claims = inspection.payload.value;
  const value =
    inspection.wire === "jose"
      ? (claims as Dict)[String(key)]
      : (claims as ReadonlyMap<number | string, unknown>).get(key);

  if (value === undefined) {
    throw new Error(`the token carries no claim under ${String(key)}`);
  }

  return value;
};

/**
 * A COSE map rendered to plain objects — for the INTEROPERABLE form alone, where
 * every key is a string.
 *
 * ⛔ Deliberately NOT used for the compact form. `Object.fromEntries` stringifies
 * an integer key, so a member that arrived under the text `"2"` would compare
 * equal to one under the integer `2` — a comparison that cannot fail. RFC 9052
 * §1.5 admits both ("In COSE, we use text strings, negative integers, and
 * unsigned integers as map keys", grammar `label = int / tstr`), and it is CBOR's
 * data model that keeps them apart. The compact assertions compare `Map` against
 * `Map`.
 */
const plain = (value: unknown): unknown =>
  value instanceof Map
    ? Object.fromEntries([...value].map(([key, inner]) => [key, plain(inner)]))
    : Array.isArray(value)
      ? value.map(plain)
      : value;

/**
 * EVERY DECLARED MEMBER IN ONE FLAT IDENTIFIER, in the DOMAIN vocabulary.
 *
 * ⚠⚠ IT IS NOT A CONFORMANT SUBJECT IDENTIFIER AND IT IS NOT MEANT TO BE. RFC
 * 9493 §3 says "A Subject Identifier MUST NOT contain any members prohibited or
 * not described by its Identifier Format", and no format describes `email` and
 * `id` and `url` together. Aegis enforces the per-format REQUIREMENT (through the
 * `subjectId` profile shape rule) and not the per-format PROHIBITION — nothing
 * can, without holding every registered format's member list — so this bag is a
 * structural probe that puts every member's spelling and label on one wire in one
 * whole-value equality. The conformant, per-format shapes are pinned at depth
 * below, where the `aliases` format makes them a single legal claim.
 */
const EVERY_MEMBER = {
  format: "iss_sub",
  iss: "https://idp.lindorm.test",
  sub: "subject-1",
  email: "subject.1@lindorm.test",
  phoneNumber: "+46700000000",
  uri: "acct:subject-1@lindorm.test",
  url: "did:example:subject-1",
  id: "opaque-subject-1",
};

/** The same identifier in the WIRE vocabulary. Written out — see the docstring. */
const EVERY_MEMBER_WIRE: Dict = {
  format: "iss_sub",
  iss: "https://idp.lindorm.test",
  sub: "subject-1",
  email: "subject.1@lindorm.test",
  phone_number: "+46700000000",
  uri: "acct:subject-1@lindorm.test",
  url: "did:example:subject-1",
  id: "opaque-subject-1",
};

/**
 * AN `aliases` IDENTIFIER — the RFC 9493 §3.2.8 shape whose `identifiers` member
 * is "a JSON array containing one or more Subject Identifiers".
 *
 * ⭐ THIS IS THE ARRAY-OF-SELF, and each element is a CONFORMANT identifier of its
 * own format: §3.2.3 `iss_sub` (iss + sub), §3.2.2 `email`, §3.2.5 `phone_number`,
 * §3.2.4 `opaque`, §3.2.6 `did` (url), §3.2.1 `account` (uri).
 *
 * ⚠ IT STOPS AT DEPTH 2 BECAUSE THE SPECIFICATION DOES: §3.2.8 — "'aliases'
 * Subject Identifiers MUST NOT be nested, i.e., the 'identifiers' member of an
 * 'aliases' Subject Identifier MUST NOT contain a Subject Identifier in the
 * Aliases Identifier Format." A depth-3 pin would assert that aegis emits a token
 * the RFC forbids.
 */
const ALIASES = {
  format: "aliases",
  identifiers: [
    { format: "iss_sub", iss: "https://idp.lindorm.test", sub: "subject-1" },
    { format: "email", email: "subject.1@lindorm.test" },
    { format: "phone_number", phoneNumber: "+46700000000" },
    { format: "opaque", id: "opaque-subject-1" },
    { format: "did", url: "did:example:subject-1" },
    { format: "account", uri: "acct:subject-1@lindorm.test" },
  ],
};

/** The same, in the WIRE vocabulary. `phoneNumber` is the one member that moves. */
const ALIASES_WIRE: Dict = {
  format: "aliases",
  identifiers: [
    { format: "iss_sub", iss: "https://idp.lindorm.test", sub: "subject-1" },
    { format: "email", email: "subject.1@lindorm.test" },
    { format: "phone_number", phone_number: "+46700000000" },
    { format: "opaque", id: "opaque-subject-1" },
    { format: "did", url: "did:example:subject-1" },
    { format: "account", uri: "acct:subject-1@lindorm.test" },
  ],
};

/** The same, as the compact COSE label map. `Map` against `Map`, at both depths. */
const ALIASES_COMPACT = new Map<number | string, unknown>([
  [FORMAT, "aliases"],
  [
    IDENTIFIERS,
    [
      new Map<number | string, unknown>([
        [FORMAT, "iss_sub"],
        [ISS, "https://idp.lindorm.test"],
        [SUB, "subject-1"],
      ]),
      new Map<number | string, unknown>([
        [FORMAT, "email"],
        [EMAIL, "subject.1@lindorm.test"],
      ]),
      new Map<number | string, unknown>([
        [FORMAT, "phone_number"],
        [PHONE_NUMBER, "+46700000000"],
      ]),
      new Map<number | string, unknown>([
        [FORMAT, "opaque"],
        [ID, "opaque-subject-1"],
      ]),
      new Map<number | string, unknown>([
        [FORMAT, "did"],
        [URL, "did:example:subject-1"],
      ]),
      new Map<number | string, unknown>([
        [FORMAT, "account"],
        [URI, "acct:subject-1@lindorm.test"],
      ]),
    ],
  ],
]);

describe("the sub_id claim on the wire", () => {
  test("a JOSE token spells every Subject Identifier member the way RFC 9493 does", async () => {
    const token = await mint("jwt", { subjectId: EVERY_MEMBER });

    // Whole-value equality, not a subset: a subset match passes over a member the
    // token dropped, and dropping a member is the failure a declared member set
    // exists to prevent. `phone_number` is the one that would show a lost
    // translation — every other declared member is spelled the same on both sides.
    expect(wireClaimOf(token, "sub_id")).toEqual(EVERY_MEMBER_WIRE);
  });

  test("a JOSE token keeps the Subject Identifier members in the order the caller wrote them", async () => {
    // JSON preserves insertion order, so this IS a statement about the bytes: a
    // translator that walked its member DECLARATION instead of the caller's value
    // would re-order every identifier and move bytes on a signed wire while every
    // round trip still agreed with itself.
    const token = await mint("jwt", {
      subjectId: { id: "opaque-subject-1", format: "opaque" },
    });

    expect(Object.keys(wireClaimOf(token, "sub_id") as Dict)).toEqual(["id", "format"]);
  });

  test("an INTEROPERABLE COSE token keys the claim and its members by their RFC 9493 names", async () => {
    const token = await mint("cwt", { subjectId: EVERY_MEMBER });
    const inspection = inspectToken(token);

    if (inspection.wire !== "cose" || inspection.payload.readable === false) {
      throw new Error("the mint did not produce a readable COSE payload");
    }

    // The CLAIM key first: a private-use integer is meaningless to any reader but
    // us, so an interoperable token must degrade it to the string name.
    expect(inspection.payload.value.has("sub_id")).toBe(true);
    expect(inspection.payload.value.has(SUB_ID_COSE_LABEL)).toBe(false);

    // Then the MEMBER keys: none of the member labels is registered anywhere, so
    // the identifier is string-keyed all the way down, with the same spellings the
    // JOSE token uses.
    expect(plain(wireClaimOf(token, "sub_id"))).toEqual(EVERY_MEMBER_WIRE);
  });

  test("a PROPRIETARY COSE token moves the claim to its label and collapses every member", async () => {
    const token = await mint("cwt", { subjectId: EVERY_MEMBER }, true);

    // Both halves of the claim's duality in one row, asserted AT the label — so a
    // token that compacted the members while leaving the claim string-keyed throws
    // in `wireClaimOf` rather than passing. `Map` against `Map`, so an integer
    // label cannot compare equal to its own text spelling.
    expect(wireClaimOf(token, SUB_ID_COSE_LABEL)).toEqual(
      new Map<number | string, unknown>([
        [FORMAT, "iss_sub"],
        [ISS, "https://idp.lindorm.test"],
        [SUB, "subject-1"],
        [EMAIL, "subject.1@lindorm.test"],
        [PHONE_NUMBER, "+46700000000"],
        [URI, "acct:subject-1@lindorm.test"],
        [URL, "did:example:subject-1"],
        [ID, "opaque-subject-1"],
      ]),
    );
  });

  // ---------------------------------------------------------------------------
  // DEPTH — the array of self.
  // ---------------------------------------------------------------------------

  test("a JOSE token carries an aliased Subject Identifier at DEPTH, member by member", async () => {
    const token = await mint("jwt", { subjectId: ALIASES });

    // ⭐ THE ARRAY-OF-SELF PROOF ON THE JOSE WIRE. Whole-value equality over the
    // outer identifier AND all six elements, so a translator that walked the
    // `identifiers` array without walking INTO its elements leaves every element's
    // `phoneNumber` untranslated and shows up here.
    expect(wireClaimOf(token, "sub_id")).toEqual(ALIASES_WIRE);
  });

  test("an INTEROPERABLE COSE token carries an aliased Subject Identifier at DEPTH", async () => {
    const token = await mint("cwt", { subjectId: ALIASES });

    expect(plain(wireClaimOf(token, "sub_id"))).toEqual(ALIASES_WIRE);
  });

  test("a PROPRIETARY COSE token compacts an aliased Subject Identifier at EVERY depth", async () => {
    const token = await mint("cwt", { subjectId: ALIASES }, true);

    // ⭐⭐ THE RECURSION PROOF ON THE WIRE, AND THE REASON THIS FILE EXISTS. A
    // compaction that reached only the outer identifier would leave six
    // string-keyed maps inside an integer-keyed parent — and every read through
    // this package would agree with itself about it, because the decoder mirrors
    // the encoder. `Map` against `Map` at both depths, so a text `"0"` cannot pass
    // for the integer `0`.
    //
    // ⚠ It also pins the ELEMENT form specifically: `CborField` reaches this
    // structure through `StructureForm: "collection"` one level in, and without
    // that branch `compactEncode` was handed the ARRAY, matched no member, and put
    // an EMPTY MAP on a signed token.
    expect(wireClaimOf(token, SUB_ID_COSE_LABEL)).toEqual(ALIASES_COMPACT);
  });

  // ---------------------------------------------------------------------------
  // The open tail, and the camelisation it sits beside.
  // ---------------------------------------------------------------------------

  test("a member RFC 9493 does not name rides UNTOUCHED on both wires, at depth", async () => {
    // RFC 9493 §3 permits an Identifier Format named by "a Collision-Resistant
    // Name as defined in [RFC7519]" — no registration required — so a conformant
    // Subject Identifier can carry members this package cannot enumerate. They are
    // carried VERBATIM, because a case flip would rewrite a name the FORMAT's
    // registrant chose. Asserted at DEPTH because a tail policy declared on the
    // claim and forgotten on the element would pass a depth-1 row and fail this
    // one — the exact hole the actor set shipped for one measurement.
    const subjectId = {
      format: "https://lindorm.test/sub-id-format",
      device_serial: "SN-0001",
      identifiers: [
        { format: "https://lindorm.test/sub-id-format", device_serial: "SN-0002" },
      ],
    };

    for (const format of ["jwt", "cwt"] as const) {
      const token = await mint(format, { subjectId });

      expect({ format, subId: plain(wireClaimOf(token, "sub_id")) }).toEqual({
        format,
        subId: subjectId,
      });
    }
  });

  test("the compact COSE encoding keeps an undeclared member instead of dropping it", async () => {
    // RFC 9052 §1.5 makes the honest encoding available: "In COSE, we use text
    // strings, negative integers, and unsigned integers as map keys", grammar
    // `label = int / tstr`. So the map is MIXED — declared members under their
    // integers, the tail under its own name — and asserting both halves in one
    // `Map` is what stops an encoder that gave up and emitted the string-keyed
    // structure wholesale from passing.
    const token = await mint(
      "cwt",
      { subjectId: { format: "opaque", id: "s-1", device_serial: "SN-0001" } },
      true,
    );

    expect(wireClaimOf(token, SUB_ID_COSE_LABEL)).toEqual(
      new Map<number | string, unknown>([
        [FORMAT, "opaque"],
        [ID, "s-1"],
        ["device_serial", "SN-0001"],
      ]),
    );
  });

  test("the camelised member reaches the RFC 9493 wire spelling on both wires", async () => {
    // ⭐⭐ THE CAMELISATION MOVES NO BYTES, AND THAT IS THE FACT WORTH PINNING.
    // `phoneNumber` resolves through the declared member to RFC 9493 §3.2.4's
    // `phone_number` on JOSE and to its label in the compact COSE map. The
    // expectations are WRITTEN OUT rather than compared against a sibling token,
    // so a walker that moved both spellings to the same WRONG place cannot satisfy
    // them.
    //
    // ⇒ The rename is a DOMAIN-SURFACE break, not a wire break. What it changes is
    // what the shape rule can enforce (`internal/utils/rules/sub-id-shape.ts`, whose
    // per-format table is domain-keyed) and what a read reports — both pinned below
    // and there — never what a deployed verifier receives.
    const domainSpelled = { format: "phone_number", phoneNumber: "+46700000000" };

    // The claim's own key moves with the mode: a private-use label on-platform, the
    // string name off it. Asked for explicitly, so a token that failed to move the
    // claim throws in `wireClaimOf` instead of comparing two absences.
    for (const format of ["jwt", "cwt"] as const) {
      for (const proprietary of [undefined, true] as const) {
        const compact = format === "cwt" && proprietary === true;
        const key = compact ? SUB_ID_COSE_LABEL : "sub_id";
        const token = await mint(format, { subjectId: domainSpelled }, proprietary);

        // ⚠ THREE SHAPES, NOT TWO — and the sibling-comparison this replaced could
        // never have shown it. A JOSE claim is a JSON OBJECT; an interoperable COSE
        // claim is a CBOR MAP with TEXT keys; a proprietary one is a CBOR map with
        // INTEGER labels. RFC 9052 §1.5 keeps the text `"format"` and an integer
        // label apart (`label = int / tstr`), so writing all three out is what makes
        // the assertion about the wire rather than about self-consistency.
        const expected =
          format === "jwt"
            ? { format: "phone_number", phone_number: "+46700000000" }
            : new Map<number | string, unknown>(
                compact
                  ? [
                      [FORMAT, "phone_number"],
                      [PHONE_NUMBER, "+46700000000"],
                    ]
                  : [
                      ["format", "phone_number"],
                      ["phone_number", "+46700000000"],
                    ],
              );

        expect(wireClaimOf(token, key), `${format}/${String(proprietary)}`).toEqual(
          expected,
        );
      }
    }
  });

  test("the WIRE spelling in a domain bag is refused, not routed onto the declared member's key", async () => {
    // ⛔⛔ THIS TEST USED TO ASSERT THE OPPOSITE, and correcting it is a finding
    // rather than cleanup. It paired `{ phone_number: … }` with
    // `{ phoneNumber: … }` and required the two to produce IDENTICAL bytes — which
    // they did, because a caller-supplied `phone_number` was an undeclared member
    // riding the `"verbatim"` tail straight onto the declared member's own outgoing
    // key. That is exactly the look-alike the walker now refuses: RFC 9493 says an
    // unknown member may be carried, and nothing says a member may be written INTO
    // ANOTHER MEMBER'S SLOT, which is what made the two indistinguishable
    // downstream. The old pin therefore documented a fail-open as a feature.
    //
    // ⭐ It also SOFTENED the very break it claimed to state. If the wire spelling
    // keeps working, the camelisation is not a break a caller ever notices — it
    // just silently stops being enforceable by the domain-keyed shape rule. Failing
    // loudly is the honest form of the same change.
    for (const format of ["jwt", "cwt"] as const) {
      await expect(
        mint(format, {
          subjectId: { format: "phone_number", phone_number: "+46700000000" },
        }),
        format,
      ).rejects.toMatchObject({
        code: "claim_structure_invalid",
        data: { claim: "subjectId" },
      });
    }
  });

  test("a Subject Identifier is READ BACK in the domain vocabulary", async () => {
    // ⭐ WHERE THE RENAME IS ACTUALLY OBSERVABLE. The bytes are RFC 9493's either
    // way (above), so the domain surface is the whole of the change: a caller
    // reads `phoneNumber` back, never the wire's `phone_number`, exactly as it
    // reads `streetAddress` back from an OIDC Core §5.1.1 address.
    for (const format of ["jwt", "cwt"] as const) {
      const token = await mint(
        format,
        { subjectId: { format: "phone_number", phoneNumber: "+46700000000" } },
        true,
      );
      const verified = await aegis.verify(token);

      expect({ format, subId: verified.claims.subjectId }).toEqual({
        format,
        subId: { format: "phone_number", phoneNumber: "+46700000000" },
      });
    }
  });

  test("a member spelled BOTH ways is refused rather than resolved by key order", async () => {
    // The declared `phoneNumber` resolves to the wire `phone_number`; a
    // caller-supplied `phone_number` rides the open tail and lands on the same key.
    // Refused at the emission boundary, with the PAIR named in a stable order —
    // which of the two arrives second is decided by key order, and a JSON payload
    // and a deterministic CBOR map do not agree about that.
    for (const format of ["jwt", "cwt"] as const) {
      await expect(
        mint(format, {
          subjectId: {
            format: "phone_number",
            phoneNumber: "+46700000000",
            phone_number: "+46700000001",
          },
        }),
        format,
      ).rejects.toMatchObject({
        code: "claim_structure_invalid",
        data: {
          claim: "subjectId",
          invalid: [
            {
              key: "subjectId.phone_number",
              message:
                'Members "phoneNumber" and "phone_number" both resolve to "phone_number" in "subjectId"',
            },
          ],
        },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // The refusals a declared structure raises.
  // ---------------------------------------------------------------------------

  test("a Subject Identifier that names no format is refused on both wires", async () => {
    // RFC 9493 §3: "A Subject Identifier MUST conform to a specific Identifier
    // Format and MUST contain a 'format' member whose value is the name of that
    // Identifier Format." Unconditional, so it is a registry `required` cell — the
    // walker enforces it under EVERY profile including this profile-free-ish
    // `default` one, where the `subjectId` profile shape rule (bound only by
    // `security_event`) never runs at all.
    for (const format of ["jwt", "cwt"] as const) {
      await expect(
        mint(format, { subjectId: { id: "opaque-subject-1" } }),
        format,
      ).rejects.toMatchObject({
        code: "claim_structure_invalid",
        data: {
          claim: "subjectId",
          invalid: [
            {
              key: "subjectId.format",
              message: 'Member "format" is required and must not be empty',
            },
          ],
        },
      });
    }
  });

  test("a format missing from an ALIASED identifier is refused at its own position", async () => {
    // ⭐ THE `required` CELL AT DEPTH, inside a collection. RFC 9493 §3.2.8 makes
    // every element of `identifiers` a Subject Identifier, so `format` is
    // mandatory there too — and the position names WHICH element, because "the
    // identifier is missing a format" is not a repairable instruction when six of
    // them are present.
    await expect(
      mint("jwt", {
        subjectId: {
          format: "aliases",
          identifiers: [{ format: "email", email: "a@b.test" }, { id: "no-format" }],
        },
      }),
    ).rejects.toMatchObject({
      code: "claim_structure_invalid",
      data: {
        claim: "subjectId",
        invalid: [
          {
            key: "subjectId.identifiers[1].format",
            message: 'Member "format" is required and must not be empty',
          },
        ],
      },
    });
  });

  test("a non-array `identifiers` is refused as a violation of the CLAIM, not of the member", async () => {
    // ⭐⭐ THE ONE PLACE `WalkContext.claim` IS READ BELOW DEPTH 1, AND NOTHING
    // COULD REACH IT UNTIL THIS CLAIM MIGRATED. `walkElements`'s non-array message
    // names the claim the walk was ENTERED for, and it needs a MEMBER whose codec
    // is `array` WITH `of` — which no declared member had, because `act`'s
    // `audience` is an array with none. So a `childPath` that overwrote `claim`
    // with the member's own domain (`Claim "identifiers" must be an array`) was an
    // EQUIVALENT MUTANT: correct-looking, unobservable, and wrong the moment
    // `sub_id.identifiers` arrived.
    //
    // The distinction is not cosmetic. `data.claim` is what a consumer branches on
    // to know WHICH claim to repair, and `identifiers` is not a claim at all — it
    // names nothing the caller can look up in the registry or remove from its bag.
    for (const format of ["jwt", "cwt"] as const) {
      await expect(
        mint(format, {
          subjectId: { format: "aliases", identifiers: "not-an-array" },
        }),
        format,
      ).rejects.toMatchObject({
        code: "claim_structure_invalid",
        data: {
          claim: "subjectId",
          invalid: [
            {
              key: "subjectId.identifiers",
              message: 'Claim "subjectId" must be an array',
            },
          ],
        },
      });
    }
  });

  test("a non-array `identifiers` READ off a token names the CLAIM too, not the member", () => {
    // ⭐⭐ THE READ DIRECTION OF THE SAME RULE, AND IT IS THE ONE THAT MATTERS
    // MOST. The mint rows above go through `writeDirection` alone — a caller's own
    // data, which the caller can fix. This side is the PRODUCER'S: a forged token
    // reaches `walkElements` through `readDirection` at the unauthenticated
    // `parse` door, and `data.claim` is what a consumer branches on to decide
    // which claim to repair. `identifiers` is not a claim at all; it names nothing
    // a consumer can look up in the registry or remove from its bag.
    //
    // ⚠ A pin on the write side alone would have left the M2 mutation
    // (`childPath` overwriting `claim` with the member's own domain) HALF caught —
    // caught for the data aegis produces, blind for the data an attacker does.
    const header = Buffer.from(
      JSON.stringify({ alg: "ES512", typ: "JWT" }),
      "utf8",
    ).toString("base64url");
    const payload = Buffer.from(
      '{"iss":"https://test.lindorm.io/","sub":"u","exp":9999999999,"sub_id":{"format":"aliases","identifiers":"not-an-array"}}',
      "utf8",
    ).toString("base64url");

    expect(() => aegis.parse(`${header}.${payload}.AAAA`)).toThrow(
      expect.objectContaining({
        code: "claim_structure_invalid",
        data: {
          claim: "subjectId",
          invalid: [
            {
              key: "subjectId.identifiers",
              message: 'Claim "subjectId" must be an array',
            },
          ],
        },
      }) as unknown as Error,
    );

    // The vocabulary door too, so the rule is not a property of one code path —
    // the same pairing the `__proto__` rows below make.
    expect(() =>
      Aegis.toDomain(
        JSON.parse('{"sub_id":{"format":"aliases","identifiers":"not-an-array"}}'),
      ),
    ).toThrow(
      expect.objectContaining({
        code: "claim_structure_invalid",
        data: {
          claim: "subjectId",
          invalid: [
            {
              key: "subjectId.identifiers",
              message: 'Claim "subjectId" must be an array',
            },
          ],
        },
      }) as unknown as Error,
    );
  });

  test("an element of `identifiers` that is not a structure is refused at its index", async () => {
    // The sibling half of the same walk: RFC 9493 §3.2.8 defines the member as an
    // array "containing one or more Subject Identifiers", and a string is not one.
    // Dropping it would report a stranger's token as listing fewer aliases than it
    // does — and would silently sign one for a caller.
    await expect(
      mint("jwt", {
        subjectId: { format: "aliases", identifiers: ["urn:subject:1"] },
      }),
    ).rejects.toMatchObject({
      code: "claim_structure_invalid",
      data: {
        claim: "subjectId",
        invalid: [
          {
            key: "subjectId.identifiers[0]",
            message: 'Element "subjectId.identifiers[0]" must be an object',
          },
        ],
      },
    });
  });

  test("a member value that is not of its declared kind never reaches the wire", async () => {
    // The symmetry the wire is the only witness to: a writer that emitted
    // `email: 42` would sign a token asserting it while this package's own reader
    // reported that member as never stated. Whole-value equality on the RAW wire,
    // because a round trip cannot see the difference between a member that was
    // never written and one the reader discarded.
    for (const format of ["jwt", "cwt"] as const) {
      const token = await mint(format, {
        subjectId: { format: "opaque", id: "s-1", email: 42 },
      });

      expect({ format, subId: plain(wireClaimOf(token, "sub_id")) }).toEqual({
        format,
        subId: { format: "opaque", id: "s-1" },
      });
    }
  });

  // ---------------------------------------------------------------------------
  // `__proto__` — the refusal that moved with the claim.
  // ---------------------------------------------------------------------------

  test("a `__proto__` member is refused at the UNAUTHENTICATED JOSE door, not made a prototype", () => {
    // ⛔⛔ THE REFUSAL THIS MIGRATION INHERITS, AND IT WAS NOT INHERITED FOR FREE.
    // "the walker already refuses it" holds only for claims the walker WALKS, and
    // until this step `sub_id` was a verbatim passthrough: `decodeBespoke` returned
    // the producer's object unchanged, so no structure walk ran, no refusal fired,
    // and `omitUndefined` then rebuilt the bag through `@lindorm/utils`'s
    // `omitFromObject` — which recurses with `result[key] = cleaned` and re-invokes
    // the setter. The result was a claim whose `Object.keys` and `JSON.stringify`
    // showed nothing while `claims.subjectId.id` returned the attacker's value:
    // data a consumer's natural read returns and every audit log renders as absent.
    // Not a regression — identical before this step.
    //
    // ⭐ THE TOKEN IS FORGED AND `parse` IS THE DOOR, because that is the real
    // threat model: `parse` reports a payload WITHOUT checking a signature, so the
    // attacker needs no key. A token minted through this package cannot carry the
    // member — the claim bag is normalised first and `omitFromObject` eats it on
    // the way out — so signing one would prove nothing about the read side.
    const header = Buffer.from(
      JSON.stringify({ alg: "ES512", typ: "JWT" }),
      "utf8",
    ).toString("base64url");
    const payload = Buffer.from(
      '{"iss":"https://test.lindorm.io/","sub":"u","exp":9999999999,"sub_id":{"__proto__":{"id":"attacker"},"format":"opaque"}}',
      "utf8",
    ).toString("base64url");

    expect(() => aegis.parse(`${header}.${payload}.AAAA`)).toThrow(
      expect.objectContaining({
        code: "claim_structure_invalid",
        data: {
          claim: "subjectId",
          invalid: [
            {
              key: "subjectId.__proto__",
              message:
                'Member "__proto__" is not a member name any structure may use, in "subjectId"',
            },
          ],
        },
      }) as unknown as Error,
    );

    // Both vocabulary doors, so the rule is not a property of one code path.
    expect(() =>
      Aegis.toDomain(JSON.parse('{"sub_id":{"__proto__":{"id":"attacker"}}}')),
    ).toThrow(
      expect.objectContaining({ code: "claim_structure_invalid" }) as unknown as Error,
    );
    expect(() =>
      Aegis.toWire(JSON.parse('{"subjectId":{"__proto__":{"id":"x"}}}')),
    ).toThrow(
      expect.objectContaining({ code: "claim_structure_invalid" }) as unknown as Error,
    );
  });

  test("a compact COSE map carrying a text `__proto__` label reaches the walker as a KEY", () => {
    // RFC 9052 §1.5 admits a TEXT label (`label = int / tstr`) and the compact
    // encoder walks the VALUE rather than the label table, so `__proto__` is a
    // reachable key in a compact Subject Identifier — no signature required,
    // because `aegis.parse` reports a payload without verifying one.
    //
    // ⭐ ASSERTED AS THE REFUSAL, which IS the own-key form observed: the walker one
    // level up refuses `__proto__` by NAME, and it can only see a key that EXISTS.
    // `compactDecode` writes each member with `Object.defineProperty`; under a
    // plain assignment no own key is created, the walker sees a one-member
    // identifier, and the token is accepted with an invisible attacker-controlled
    // property. So the refusal fires exactly when the data property was created.
    const claims = new Map<number | string, unknown>([
      [1, ISSUER],
      [2, "user-1"],
      [4, 9999999999],
      [
        SUB_ID_COSE_LABEL,
        new Map<number | string, unknown>([
          [FORMAT, "opaque"],
          ["__proto__", { id: "attacker" }],
        ]),
      ],
    ]);

    // A COSE_Sign1 nobody signed, inside the CWT tag — built with raw `cbor2`, so
    // nothing about the token comes from the code under test.
    const forged = Buffer.from(
      encode(
        new Tag(
          CBOR_TAG.cwt,
          new Tag(CBOR_TAG.sign1, [
            encode(new Map<number, unknown>([[1, -36]])),
            new Map<number, unknown>(),
            encode(claims),
            Buffer.alloc(4),
          ]),
        ),
      ),
    ).toString("base64url");

    expect(() => aegis.parse(forged)).toThrow(
      expect.objectContaining({
        code: "claim_structure_invalid",
        data: {
          claim: "subjectId",
          invalid: [
            {
              key: "subjectId.__proto__",
              message:
                'Member "__proto__" is not a member name any structure may use, in "subjectId"',
            },
          ],
        },
      }) as unknown as Error,
    );
  });

  test("a `__proto__` inside an ALIASED identifier is refused at its own depth", () => {
    // ⭐ THE SAME REFUSAL ONE LEVEL IN, through the collection arm. A guard applied
    // at the claim boundary alone would pass this token — the outer identifier is
    // clean, and the hostile member sits inside an element the walker only reaches
    // by descending. The key names WHICH alias, because at depth `__proto__` alone
    // does not locate it.
    const header = Buffer.from(
      JSON.stringify({ alg: "ES512", typ: "JWT" }),
      "utf8",
    ).toString("base64url");
    const payload = Buffer.from(
      '{"iss":"https://test.lindorm.io/","sub":"u","exp":9999999999,"sub_id":{"format":"aliases","identifiers":[{"format":"email","email":"a@b.test"},{"format":"opaque","__proto__":{"id":"attacker"}}]}}',
      "utf8",
    ).toString("base64url");

    expect(() => aegis.parse(`${header}.${payload}.AAAA`)).toThrow(
      expect.objectContaining({
        code: "claim_structure_invalid",
        data: {
          claim: "subjectId",
          invalid: [
            {
              key: "subjectId.identifiers[1].__proto__",
              message:
                'Member "__proto__" is not a member name any structure may use, in "subjectId.identifiers[1]"',
            },
          ],
        },
      }) as unknown as Error,
    );
  });

  test("a signed CWT keying one member by BOTH its label and its name is refused", async () => {
    // ⛔⛔ THE COSE-ONLY COLLISION, END TO END ON A REAL SIGNED TOKEN. RFC 9052
    // §1.5 makes the integer label and the interoperable text name different map
    // keys ("In COSE, we use text strings, negative integers, and unsigned
    // integers as map keys", grammar `label = int / tstr`) — but they are two
    // renderings of ONE declared member, so a map carrying both said two things
    // about one field and the LAST one won, silently. Measured before the fix, at
    // `aegis.parse` AND at `aegis.verify`: `sub_id` as `Map { 0 => "phone_number", 5 => "+46700000000",
    // "phone_number" => "+00000000000" }` read back carrying the FORGED number on
    // both doors.
    //
    // ⚠ THE UNIT PIN IS IN `internal/cose/compact-map.test.ts`; this one exists
    // because that one cannot see the ROUTING. `internal/cose/cwt-spec.ts` gates
    // the compact ENCODE on `proprietary` and leaves DECODE ungated, which is what
    // makes any mixed map reach the walker — a fact only an end-to-end token shows.
    //
    // ⚠ It is signed through the real kit rather than forged: a `Map` value rides
    // the interoperable arm verbatim into CBOR, so this is a token that verifies.
    const signed = await aegis.cwt.sign(
      {
        iss: ISSUER,
        sub: "user-1",
        exp: Math.floor(Date.now() / 1000) + 3600,
        sub_id: new Map<number | string, unknown>([
          [0, "phone_number"],
          [5, "+46700000000"],
          ["phone_number", "+00000000000"],
        ]),
      } as never,
      { key: { kryptos: TEST_EC_KEY_SIG } } as never,
    );

    const expected = expect.objectContaining({
      code: "cose_duplicate_member_key",
      data: { claim: "subjectId", member: "phone_number", label: 5, key: "phone_number" },
    }) as unknown as Error;

    expect(() => aegis.parse(signed.token)).toThrow(expected);
    await expect(aegis.verify(signed.token)).rejects.toThrow(expected);
  });
});
