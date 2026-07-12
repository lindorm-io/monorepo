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
    expect(coseTyp({ presence: "required", value: jose })).toBe(cose);
  });

  test("maps an optional-presence typ by its value (presence is verify-side only)", () => {
    expect(coseTyp({ presence: "optional", value: "JWT" })).toBe("application/cwt");
  });

  test("presence none maps to undefined (no mandated typ)", () => {
    expect(coseTyp({ presence: "none" })).toBeUndefined();
  });
});
