import { describe, expect, test } from "vitest";
import { TokenType } from "./TokenType.js";

describe("TokenType", () => {
  test("should match snapshot", () => {
    expect(TokenType).toMatchSnapshot();
  });

  test("should carry the registered type names with their exact casing", () => {
    expect(Object.values(TokenType)).toEqual(["Bearer", "DPoP"]);
  });

  test("should derive a closed type from the runtime values", () => {
    const fromEnum: TokenType = TokenType.Bearer;
    const fromLiteral: TokenType = "DPoP";
    // @ts-expect-error the type is CLOSED — an unregistered token type is not an TokenType
    const rejected: TokenType = "mac";
    // a deployment issuing another registered type widens in ITS OWN package, never here
    const widened: TokenType | "urn:acme:token-type:paseto" =
      "urn:acme:token-type:paseto";

    expect([fromEnum, fromLiteral, rejected, widened]).toMatchSnapshot();
  });

  test("should not absorb the case-insensitive spellings RFC 6749 section 5.1 permits", () => {
    // @ts-expect-error the set is the canonical spelling a provider EMITS; a
    // reader accepting a case-variant normalises before comparing
    const lowercase: TokenType = "bearer";

    expect(lowercase).toBe("bearer");
  });
});
