import { describe, expect, test } from "vitest";
import { coseTyp, coseTypFromTokenType } from "./cose-typ.js";

describe("coseTyp", () => {
  test.each([
    ["application/at+jwt", "application/at+cwt"],
    ["application/secevent+jwt", "application/secevent+cwt"],
    ["application/logout+jwt", "application/logout+cwt"],
    ["application/erasure+jwt", "application/erasure+cwt"],
    ["application/delegation+jwt", "application/delegation+cwt"],
    ["application/token-introspection+jwt", "application/token-introspection+cwt"],
    ["JWT", "application/cwt"],
  ])("maps the JOSE typ %s to the CWT media type %s", (jose, cose) => {
    expect(coseTyp({ presence: "required", value: jose })).toBe(cose);
  });

  test("presence none maps to undefined (no mandated typ)", () => {
    expect(coseTyp({ presence: "none" })).toBeUndefined();
  });
});

describe("coseTypFromTokenType", () => {
  test.each([
    ["access_token", "application/at+cwt"],
    ["refresh_token", "application/rt+cwt"],
    ["security_event", "application/secevent+cwt"],
    // No structured JOSE form (bare JWT) or no token type ⇒ the one registered
    // CWT media type.
    ["id_token", "application/cwt"],
    [undefined, "application/cwt"],
  ])("maps the bare tokenType %s to the CWT media type %s", (tokenType, cwt) => {
    expect(coseTypFromTokenType(tokenType)).toBe(cwt);
  });

  test("inherits computeTypHeader's validation (a '+' in the type throws)", () => {
    expect(() => coseTypFromTokenType("at+jwt")).toThrow();
  });
});
