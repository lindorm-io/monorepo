import { describe, expect, test } from "vitest";
import { subIdShape } from "./sub-id-shape.js";

describe("subIdShape", () => {
  test("passes when subjectId is absent", () => {
    expect(subIdShape({})).toEqual([]);
  });

  test("passes for a valid iss_sub format", () => {
    expect(
      subIdShape({ subjectId: { format: "iss_sub", iss: "https://x", sub: "s" } }),
    ).toEqual([]);
  });

  /**
   * ⭐ THE CONTROL FOR THE ONE MEMBER THAT WAS RE-KEYED. The per-format table is
   * keyed by the member's DOMAIN name, and `phone_number` -> `phoneNumber` is the
   * only entry the camelisation moved. Without this row the failing row below
   * cannot tell "the member is empty" from "the table looks up a key the domain
   * bag never has" — both produce the same entry, and the second would mean the
   * Phone Number format's REQUIRED member (RFC 9493 §3.2.5) is unenforceable.
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
   * is genuinely absent and the rule says so.
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
    expect(subIdShape({ subjectId: { iss: "x" } })).toMatchSnapshot();
  });

  test("fails when a required member of the format is missing", () => {
    expect(subIdShape({ subjectId: { format: "iss_sub", iss: "x" } })).toMatchSnapshot();
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
    ["iss_sub", { format: "iss_sub", iss: "https://x", sub: "" }],
    ["opaque", { format: "opaque", id: "" }],
    ["phone_number", { format: "phone_number", phoneNumber: "" }],
    ["uri", { format: "uri", uri: "" }],
  ])("fails when the %s format's required member is empty", (_format, subjectId) => {
    expect(subIdShape({ subjectId })).toMatchSnapshot();
  });

  // `null` reaches this rule from MINT, not from the wire: a caller minting from a
  // database row hands null members straight in (`assemble-common-claims.ts` keeps
  // every non-`undefined` value), while a wire `null` is classified as absence
  // before any rule runs (`isNotStated`, `translate.ts`).
  test("fails when a required member is null", () => {
    expect(subIdShape({ subjectId: { format: "opaque", id: null } })).toMatchSnapshot();
  });
});
