import { describe, expect, test } from "vitest";
import { HEADER_SPECS, headerByJose, headerJoseName } from "./header-registry.js";
import { isCritEligible } from "./is-crit-eligible.js";

/**
 * ⭐ THE ONE PLACE THE COLUMN READ IS DIRECTLY OBSERVABLE, and that is why this
 * predicate has a file and a test of its own rather than living inline in the
 * two gates that call it.
 *
 * On the READ path it is not observable: `rejectUnknownCritical` runs
 * `validateCrit` first, which refuses every IANA-registered name, and every
 * registered parameter but `oid` is IANA-registered — so a version of that loop
 * asking merely "is this parameter registered" passes the ENTIRE suite
 * (measured: 4 failed / 2679 passed, exactly the declared baseline). Probed
 * HERE, the two readings part company on twenty names.
 */
describe("isCritEligible", () => {
  test("the eligible set is exactly the registry's own", () => {
    const eligible = HEADER_SPECS.filter((spec) => isCritEligible(headerJoseName(spec)));

    expect(eligible.map(headerJoseName)).toEqual(["oid"]);
  });

  /**
   * ⚠ THE DISTINCTION THE READ PATH CANNOT SHOW. `alg` and every other
   * specification-defined parameter IS registered — `headerByJose` answers for
   * it — and is NOT crit-eligible. A predicate that returned "is this
   * registered" would be wrong for all twenty and green everywhere else.
   */
  test.each(["alg", "typ", "cty", "kid", "crit", "enc", "x5c", "x5t", "x5t#S256", "zip"])(
    "a registered parameter (%s) is NOT eligible, though the registry answers for it",
    (name) => {
      expect(headerByJose(name), `${name} is not registered at all`).toBeDefined();
      expect(isCritEligible(name)).toBe(false);
    },
  );

  test("the one eligible parameter is eligible", () => {
    expect(isCritEligible("oid")).toBe(true);
  });

  test("an unregistered name is not eligible", () => {
    expect(isCritEligible("ext")).toBe(false);
  });

  /**
   * ⚠ A member is CALLER-CONTROLLED, so the lookup must be an OWN-key one.
   * `headerByJose` is a `Map` read and a Map has no prototype chain — a
   * plain-object registry would answer for these with a function, and
   * `fn?.critEligible === true` would be false only by luck.
   */
  test.each(["toString", "constructor", "valueOf", "hasOwnProperty", "__proto__"])(
    "an Object.prototype member (%s) is not eligible",
    (name) => {
      expect(isCritEligible(name)).toBe(false);
    },
  );

  test.each([1, null, undefined, {}, ["oid"]])(
    "a non-string member (%s) is not eligible",
    (member) => {
      expect(isCritEligible(member)).toBe(false);
    },
  );
});
