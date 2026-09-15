import type { Dict } from "@lindorm/types";
import { describe, expect, test } from "vitest";
import { subIdShape } from "./sub-id-shape.js";

describe("subIdShape", () => {
  test("passes when subjectId is absent", () => {
    expect(subIdShape({})).toEqual([]);
  });

  test("passes for a valid iss_sub format", () => {
    expect(
      subIdShape({ subjectId: { format: "iss_sub", issuer: "https://x", subject: "s" } }),
    ).toEqual([]);
  });

  /**
   * The per-format table is keyed by the member's DOMAIN name, which diverges
   * from the wire spelling for `issuer`, `subject` and `phoneNumber`.
   * Without this row the failing row below cannot tell "the member is empty"
   * from "the table looks up a key the domain bag never has" — both produce the
   * same entry, and the second would mean the Phone Number format's REQUIRED
   * member (RFC 9493 §3.2.5) is unenforceable.
   */
  test("passes for the phone_number format spelled in the domain vocabulary", () => {
    expect(
      subIdShape({ subjectId: { format: "phone_number", phoneNumber: "+46700000000" } }),
    ).toEqual([]);
  });

  /**
   * ⚠ THE WIRE SPELLING DOES NOT SATISFY THE DEMAND, and that is the migration
   * stated as a behaviour. A caller writing `phone_number` in the DOMAIN bag is
   * writing a member this rule does not declare, so the format's required member
   * is genuinely absent AND the format describes nothing by that name, so the
   * identifier is refused on both counts (RFC 9493 §3).
   * ⚠ THIS IS THE RULE'S OWN ANSWER, NOT A REACHABLE END-TO-END STATE. Through a
   * real mint the translator REFUSES it first — `phone_number` resolves onto the
   * declared `phoneNumber`'s outgoing key, which is a collision — so a caller
   * meets that refusal and never this one. The rule is called directly here,
   * which is the only way to see what it answers on its own.
   */
  test("fails for the phone_number format spelled in the wire vocabulary", () => {
    expect(
      subIdShape({ subjectId: { format: "phone_number", phone_number: "+46700000000" } }),
    ).toMatchSnapshot();
  });

  test("passes for an unknown format with only format", () => {
    expect(subIdShape({ subjectId: { format: "custom_format" } })).toEqual([]);
  });

  test("fails when subjectId is not an object", () => {
    expect(subIdShape({ subjectId: "x" })).toMatchSnapshot();
  });

  test("fails when format is missing", () => {
    expect(subIdShape({ subjectId: { issuer: "x" } })).toMatchSnapshot();
  });

  test("fails when a required member of the format is missing", () => {
    expect(
      subIdShape({ subjectId: { format: "iss_sub", issuer: "x" } }),
    ).toMatchSnapshot();
  });

  /**
   * ⛔⛔ A FORMAT NAMED AFTER AN `Object.prototype` MEMBER IS AN UNKNOWN FORMAT,
   * NOT A CRASH — and it WAS a crash. `SUBJECT_IDENTIFIER_REQUIRED_MEMBERS` was a
   * plain object literal, so `TABLE["constructor"]` returned the `Object`
   * constructor, `?? []` never fired, and the `for…of` over it threw a bare
   * `TypeError` that escapes this package's `AegisDomainError` contract entirely.
   * An Identifier Format name is unconstrained producer text (RFC 9493 §3), and an
   * unknown format carries no extra required members — which is what these rows
   * assert. ⚠ Looked up in an object literal instead of a `Map`, a prototype key
   * escapes a bare `TypeError: required is not iterable` from both public doors:
   * `aegis.mint("security_event", …)` and the verify floor.
   *
   * ⚠ FOUR NAMES, not one. `constructor` is a DATA property on
   * `Object.prototype` while `toString`/`valueOf`/`hasOwnProperty` are functions —
   * different values, the same fault — so a fix that special-cased the first would
   * pass a single row.
   */
  test.each(["constructor", "toString", "valueOf", "hasOwnProperty"])(
    "treats the format %s as an unknown format rather than throwing",
    (format) => {
      expect(subIdShape({ subjectId: { format, id: "s-1" } })).toEqual([]);
    },
  );

  /**
   * A format's required member is what IDENTIFIES the subject (RFC 9493 §3), so
   * an empty one identifies nobody and cannot satisfy the demand for it. One row
   * per format, because the member name comes from a per-format table and a
   * single row would only prove the one entry it happened to pick.
   *
   * ⚠ Live on `security_event`, which requires `subjectId` and FORBIDS `subject`
   * — `sub_id` is the only thing naming the subject of the event there, so
   * without this a security event token identifying nobody mints and verifies
   * clean.
   */
  test.each([
    ["account", { format: "account", uri: "" }],
    ["aliases", { format: "aliases", identifiers: [] }],
    ["did", { format: "did", url: "" }],
    ["email", { format: "email", email: "" }],
    ["iss_sub", { format: "iss_sub", issuer: "https://x", subject: "" }],
    ["opaque", { format: "opaque", id: "" }],
    ["phone_number", { format: "phone_number", phoneNumber: "" }],
    ["uri", { format: "uri", uri: "" }],
  ])("fails when the %s format's required member is empty", (_format, subjectId) => {
    expect(subIdShape({ subjectId })).toMatchSnapshot();
  });

  /**
   * SPECIFICATION AT VERIFY (RFC 9493 §3): the ceiling holds in both directions
   * the profile names the rule in
   * (`internal/profiles/definitions/security-event.ts`).
   *
   * One row per format, because the permitted set is DERIVED from the per-format
   * required table (`internal/claims/sub-id.ts`) and a single row would prove only
   * the entry it happened to pick. Every added member below is one aegis DECLARES,
   * so the structure walker carries it at every depth and nothing but this rule
   * refuses it.
   */
  test.each([
    [
      "account",
      {
        format: "account",
        uri: "acct:example.user@service.example.com",
        email: "user@example.com",
      },
    ],
    [
      "aliases",
      {
        format: "aliases",
        identifiers: [{ format: "email", email: "user@example.com" }],
        uri: "https://user.example.com/",
      },
    ],
    [
      "did",
      { format: "did", url: "did:example:123456", uri: "https://user.example.com/" },
    ],
    [
      "email",
      { format: "email", email: "user@example.com", uri: "https://user.example.com/" },
    ],
    [
      "iss_sub",
      {
        format: "iss_sub",
        issuer: "https://issuer.example.com/",
        subject: "145234573",
        uri: "https://user.example.com/",
      },
    ],
    [
      "opaque",
      {
        format: "opaque",
        id: "11112222333344445555",
        uri: "https://user.example.com/",
      },
    ],
    [
      "phone_number",
      {
        format: "phone_number",
        phoneNumber: "+12065550100",
        uri: "https://user.example.com/",
      },
    ],
    [
      "uri",
      { format: "uri", uri: "https://user.example.com/", email: "user@example.com" },
    ],
  ])(
    "fails for the %s format carrying a member it does not describe",
    (_format, subjectId) => {
      expect(subIdShape({ subjectId })).toMatchSnapshot();
    },
  );

  /**
   * The permitted set is DERIVED — the format key plus that format's required
   * members (`internal/claims/sub-id.ts`) — and no second table states it
   * (RFC 9493 §3.2).
   *
   * ⚠ A format DESCRIBING a member it does not REQUIRE would be refused a
   * conformant identifier here. Its permitted members would then have to be
   * stated apart from its required ones, and this row is where that lands.
   */
  test("refuses a member beyond the format's required ones, no RFC 9493 §3.2 format describing an optional member", () => {
    expect(
      subIdShape({
        subjectId: { format: "opaque", id: "s-1", url: "did:example:123456" },
      }),
    ).toMatchSnapshot();
  });

  /**
   * The member set is OPEN (`internal/claims/sub-id-members.ts`), so the walker
   * carries a member aegis does not declare under the producer's own spelling. The
   * ceiling is per FORMAT, not per declaration (RFC 9493 §3).
   */
  test("fails when a modelled format carries a member aegis does not declare", () => {
    expect(
      subIdShape({
        subjectId: { format: "email", email: "user@example.com", given_name: "x" },
      }),
    ).toMatchSnapshot();
  });

  /**
   * What an unmodelled format's members are is that format's business
   * (RFC 9493 §3). A ceiling here would refuse conformant security events and the
   * deployment's only remedy would be to stop using the profile.
   */
  test("passes for an unknown format carrying members aegis does not model", () => {
    expect(
      subIdShape({ subjectId: { format: "custom_format", custom_member: "x" } }),
    ).toEqual([]);
  });

  /** A member explicitly handed `undefined` names nothing — the vocabulary
   * reading every prohibition takes (`is-claim-omitted.ts`). It reaches no wire,
   * so refusing it would refuse an identifier that emits a conformant one. */
  test("passes when a member the format does not describe is undefined", () => {
    expect(
      subIdShape({
        subjectId: { format: "email", email: "user@example.com", uri: undefined },
      }),
    ).toEqual([]);
  });

  /**
   * Every rule above holds inside an element of an alias list, and the entry
   * names the POSITION it holds (RFC 9493 §3.2.8).
   */
  test("passes for an aliases identifier holding conformant identifiers of several formats", () => {
    expect(
      subIdShape({
        subjectId: {
          format: "aliases",
          identifiers: [
            { format: "email", email: "user@example.com" },
            { format: "phone_number", phoneNumber: "+12065550100" },
            { format: "opaque", id: "11112222333344445555" },
          ],
        },
      }),
    ).toEqual([]);
  });

  /**
   * The refusal is the POSITION's, not the outer identifier's (RFC 9493 §3.2.8):
   * a list of a dozen aliases says which one has to change.
   */
  test("fails when an aliases identifier holds an aliases identifier", () => {
    expect(
      subIdShape({
        subjectId: {
          format: "aliases",
          identifiers: [
            { format: "email", email: "user@example.com" },
            {
              format: "aliases",
              identifiers: [{ format: "opaque", id: "11112222333344445555" }],
            },
          ],
        },
      }),
    ).toMatchSnapshot();
  });

  /**
   * ⛔ A NESTED `aliases` IS REFUSED WITHOUT DESCENDING INTO IT, and the walk is
   * bounded by exactly that. An identifier that holds ITSELF is reachable from a
   * caller's own bag at mint, and descending into one recurses until the stack
   * gives out — a bare `RangeError` escaping this package's `AegisDomainError`
   * contract from both public doors.
   */
  test("fails once for an aliases identifier that holds itself", () => {
    const subjectId: Dict = { format: "aliases", identifiers: [] };

    (subjectId.identifiers as Array<Dict>).push(subjectId);

    expect(subIdShape({ subjectId })).toMatchSnapshot();
  });

  test("fails when an element of identifiers lacks the member its own format requires", () => {
    expect(
      subIdShape({
        subjectId: { format: "aliases", identifiers: [{ format: "email", email: "" }] },
      }),
    ).toMatchSnapshot();
  });

  test("fails when an element of identifiers carries a member its own format does not describe", () => {
    expect(
      subIdShape({
        subjectId: {
          format: "aliases",
          identifiers: [
            { format: "opaque", id: "11112222333344445555", email: "user@example.com" },
          ],
        },
      }),
    ).toMatchSnapshot();
  });

  test("fails when an element of identifiers is not an object", () => {
    expect(
      subIdShape({ subjectId: { format: "aliases", identifiers: ["urn:subject:1"] } }),
    ).toMatchSnapshot();
  });

  test("fails when an element of identifiers names no format", () => {
    expect(
      subIdShape({ subjectId: { format: "aliases", identifiers: [{ id: "s-1" }] } }),
    ).toMatchSnapshot();
  });

  /**
   * Whether `identifiers` is an array at all is the STRUCTURE's question, refused
   * by the walker in both directions and under every profile.
   * pinned: classes/sub-id-claim-wire.test.ts#a non-array `identifiers` is refused as a violation of the CLAIM, not of the member
   */
  test("leaves a non-array identifiers to the structure walker", () => {
    expect(
      subIdShape({ subjectId: { format: "aliases", identifiers: "not-an-array" } }),
    ).toEqual([]);
  });

  // `null` reaches this rule from MINT, not from the wire: a caller minting from a
  // database row hands null members straight in (`assemble-common-claims.ts` keeps
  // every non-`undefined` value), while a wire `null` is classified as absence
  // before any rule runs (`isNotStated`, `translate.ts`).
  test("fails when a required member is null", () => {
    expect(subIdShape({ subjectId: { format: "opaque", id: null } })).toMatchSnapshot();
  });
});
