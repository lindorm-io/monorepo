import { describe, expect, test } from "vitest";
import { isPrivateUseLabel } from "./is-private-use-label.js";

/**
 * The boundary, pinned with LITERALS — RFC 8152 §16.2 and RFC 8392 §9.1.1.
 *
 * ⚠ `-65536` ITSELF IS NOT PRIVATE USE. An off-by-one here goes the dangerous way:
 * it would degrade a parameter registered elsewhere, silently renaming somebody
 * else's label.
 */
describe("isPrivateUseLabel", () => {
  test("the first private-use value is -65537, one below the boundary", () => {
    expect(isPrivateUseLabel(-65537)).toBe(true);
  });

  test("-65536 is NOT private use — it is the last delegated value", () => {
    expect(isPrivateUseLabel(-65536)).toBe(false);
  });

  test.each([-70000, -100000, -1_000_000])("%i is private use", (label) => {
    expect(isPrivateUseLabel(label)).toBe(true);
  });

  test.each([
    // RFC 9052 §3.1 — the core COSE header parameters.
    1, 2, 3, 4, 5, 16,
    // RFC 9360 §2 — the X.509 parameters.
    33, 34, 35,
    // RFC 8392 §4 — the registered CWT claim keys.
    7,
    // The algorithm-delegated band (RFC 8152 §16.3), which is NOT private use.
    -1, -128, -65535,
    // Zero and the positive space above the registries.
    0, 65536,
  ])("%i is NOT private use", (label) => {
    expect(isPrivateUseLabel(label)).toBe(false);
  });
});
