import { describe, expect, test } from "vitest";
import { declaredCritToWire } from "./declared-crit-to-wire.js";

describe("declaredCritToWire", () => {
  test("passes an absent declaration through as absent", () => {
    // `undefined` is "nothing declared", which the crit gate reads as the strict
    // default. It must not become `[]` — an empty array is the same verdict but a
    // different value for anything downstream that distinguishes them.
    expect(declaredCritToWire(undefined)).toBeUndefined();
  });

  test("resolves a registered parameter from its DOMAIN name to its wire name", () => {
    expect(declaredCritToWire(["objectId"])).toEqual(["oid"]);
  });

  test("carries an unregistered custom parameter verbatim", () => {
    // A custom parameter is spelled identically at both tiers — no registry row
    // answers for it, so there is nothing to translate.
    expect(declaredCritToWire(["x-lindorm-hint"])).toEqual(["x-lindorm-hint"]);
  });

  test("refuses a registered parameter spelled in the WIRE vocabulary", () => {
    // `criticalToWire` is idempotent, so without this gate the wire spelling
    // would work at the domain door and the door would speak two vocabularies.
    expect(() => declaredCritToWire(["oid"])).toThrow(
      expect.objectContaining({
        code: "crit_declaration_not_domain_named",
        data: { parameter: "oid", expected: "objectId" },
      }),
    );
  });

  test.each(["jwk", "zip"])(
    "accepts %s, whose domain and wire spellings coincide",
    (member) => {
      // Both resolve through `headerByDomain`, so neither reaches the refusal —
      // the check must not fire on a name that IS the domain name.
      expect(declaredCritToWire([member])).toEqual([member]);
    },
  );

  test("a prototype member is neither resolved nor refused", () => {
    // Both registry lookups are `Map` reads. Through a plain object
    // `"toString"` would resolve to a function and the refusal would fire on a
    // name no caller could repair; here it is carried like any other unregistered
    // name and refused downstream for naming nothing the header carries.
    expect(declaredCritToWire(["toString"])).toEqual(["toString"]);
  });
});
