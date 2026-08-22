import { describe, expect, test } from "vitest";
import { cnfShape } from "./cnf-shape.js";

// A real 32-byte SHA-256 digest, base64url-encoded.
const VALID_JKT = "LXEWQrcmsEQBYnyp-6wy9chTD7GQPMTbAiWHF5IaSIE";

describe("cnfShape", () => {
  test("passes when cnf is absent", () => {
    expect(cnfShape({})).toEqual([]);
  });

  test("passes for a valid jkt thumbprint", () => {
    expect(cnfShape({ confirmation: { thumbprint: VALID_JKT } })).toEqual([]);
  });

  test("fails when cnf is not an object", () => {
    expect(cnfShape({ confirmation: "x" })).toMatchSnapshot();
  });

  /**
   * ⭐ THE RULE IS THE GRAMMAR, AND ONLY THE GRAMMAR. ⛔ An allow list of the
   * declared members here would be WRONG rather than merely duplicated —
   * RFC 7800 §3.1 and RFC 7800 §6.2 make the set extensible, so it would refuse
   * members RFC 7800 itself defines. The member SET is the claim translator's
   * business (`internal/claims/cnf-members.ts`), in both directions and under
   * every profile.
   */
  test("ignores a confirmation member it does not understand", () => {
    expect(cnfShape({ confirmation: { thumbprint: VALID_JKT, surprise: true } })).toEqual(
      [],
    );
  });

  /**
   * ⚠ THE EMPTY CONFIRMATION stays unrefused HERE: it is refused by the
   * translator on the way out and by the verify policy gate on the way in,
   * neither of which a profile has to opt into. A
   * third refusal in a rule three profiles name would be the weakest of the
   * three and would say the same thing.
   */
  test("says nothing about an empty confirmation — that verdict is not this rule's", () => {
    expect(cnfShape({ confirmation: {} })).toEqual([]);
  });

  test("fails when jkt is the wrong byte length", () => {
    expect(cnfShape({ confirmation: { thumbprint: "YWJj" } })).toMatchSnapshot();
  });

  test("fails when jkt is not a string", () => {
    expect(cnfShape({ confirmation: { thumbprint: 42 } })).toMatchSnapshot();
  });

  /**
   * ⚠ THE CATCH BRANCH, which had no test at all. `B64.toBuffer` throws for input
   * that is not base64url, and the message a caller gets ("must be valid
   * base64url") is a DIFFERENT repair instruction from the byte-length one — a
   * 43-character value in the wrong alphabet is not a short digest.
   */
  test("fails when jkt is not valid base64url", () => {
    expect(cnfShape({ confirmation: { thumbprint: "***" } })).toMatchSnapshot();
  });
});
