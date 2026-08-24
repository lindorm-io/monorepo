import { describe, expect, test } from "vitest";
import { CLAIM_SPECS } from "../claims/claims-registry.js";
import { HEADER_SPECS } from "../header/header-registry.js";
import { WIRE_TAGS } from "./wire.js";

describe("wire", () => {
  test("WIRE_TAGS is every wire tag, in declaration order", () => {
    expect(WIRE_TAGS).toEqual(["jose", "cose"]);
  });

  test("only COSE keys parameters by integer label", () => {
    for (const spec of [...CLAIM_SPECS, ...HEADER_SPECS]) {
      expect(spec.wire.jose.kind, `${spec.domain} is label-keyed on JOSE`).not.toBe(
        "label",
      );
    }

    expect(
      [...CLAIM_SPECS, ...HEADER_SPECS].some((spec) => spec.wire.cose.kind === "label"),
      "no registry entry is label-keyed on COSE",
    ).toBe(true);
  });

  test("both registries are total over every wire in WIRE_TAGS", () => {
    // The compile-time mechanism is `wire: Record<Wire, WireKey>`. This is the
    // runtime half over BOTH tables at once — the check that would go red the
    // moment a third wire joined the union without every entry gaining a key.
    for (const spec of [...CLAIM_SPECS, ...HEADER_SPECS]) {
      expect(Object.keys(spec.wire).sort()).toEqual([...WIRE_TAGS].sort());
    }
  });
});
