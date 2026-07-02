import { TEST_OCT_KEY_B64 } from "../__fixtures__/oct-keys.js";
import { KRYPTOS_BRAND } from "../internal/constants/brand.js";
import { Kryptos } from "./Kryptos.js";
import { KryptosKit } from "./KryptosKit.js";
import { describe, expect, test } from "vitest";

describe("KryptosKit brand (dual-install resilience)", () => {
  test("recognises a real Kryptos instance via the brand", () => {
    const kryptos = KryptosKit.from.b64(TEST_OCT_KEY_B64);

    expect(KryptosKit.isKryptos(kryptos)).toBe(true);
    expect(KryptosKit.isOct(kryptos)).toBe(true);
  });

  test("recognises a foreign-copy key that is NOT `instanceof` the local Kryptos", () => {
    // Simulates a key created by a *different* physical copy of @lindorm/kryptos:
    // it carries the global-registry brand on its constructor but is not an
    // instance of this copy's Kryptos class, so `instanceof` would return false.
    const foreign = {
      type: "oct",
      curve: null,
      constructor: { [KRYPTOS_BRAND]: true },
    };

    expect(foreign).not.toBeInstanceOf(Kryptos);
    expect(KryptosKit.isKryptos(foreign)).toBe(true);
    expect(KryptosKit.isOct(foreign as never)).toBe(true);
    expect(KryptosKit.isEc(foreign as never)).toBe(false);
  });

  test("rejects an unbranded object even when it is shaped like a key", () => {
    const lookalike = { type: "oct", curve: null };

    expect(KryptosKit.isKryptos(lookalike)).toBe(false);
    expect(KryptosKit.isOct(lookalike as never)).toBe(false);
  });

  test("rejects null, undefined, and primitives", () => {
    expect(KryptosKit.isKryptos(null)).toBe(false);
    expect(KryptosKit.isKryptos(undefined)).toBe(false);
    expect(KryptosKit.isKryptos("kryptos")).toBe(false);
    expect(KryptosKit.isKryptos(42)).toBe(false);
  });

  test("the brand uses the global symbol registry under the lindorm urn", () => {
    // The same urn key must resolve to the same symbol across module copies;
    // this is what makes the brand survive duplicate installs.
    expect(KRYPTOS_BRAND).toBe(Symbol.for("urn:lindorm:kryptos:brand:kryptos"));
  });
});
