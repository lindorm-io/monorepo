import { describe, expect, test } from "vitest";
import { coseTyp } from "./cose-typ.js";

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
    expect(coseTyp(jose)).toBe(cose);
  });

  test("a null profile typ maps to undefined (no mandated typ)", () => {
    expect(coseTyp(null)).toBeUndefined();
  });
});
