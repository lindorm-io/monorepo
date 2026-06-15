import { describe, expect, test } from "vitest";
import { coseTyp } from "./cose-typ.js";

describe("coseTyp", () => {
  test.each([
    ["at+jwt", "application/at+cwt"],
    ["secevent+jwt", "application/secevent+cwt"],
    ["logout+jwt", "application/logout+cwt"],
    ["erasure+jwt", "application/erasure+cwt"],
    ["delegation+jwt", "application/delegation+cwt"],
    ["token-introspection+jwt", "application/token-introspection+cwt"],
    ["JWT", "application/cwt"],
  ])("maps the JOSE typ %s to the CWT media type %s", (jose, cose) => {
    expect(coseTyp(jose)).toBe(cose);
  });

  test("a null profile typ maps to undefined (no mandated typ)", () => {
    expect(coseTyp(null)).toBeUndefined();
  });
});
