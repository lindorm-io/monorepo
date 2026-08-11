import { describe, expect, test } from "vitest";
import { CLAIM_SPECS } from "../claims/claims-registry.js";
import { HEADER_SPECS } from "../header/header-registry.js";
import { WIRE_TAGS, WIRES } from "./wire.js";

describe("WIRES", () => {
  test("the descriptor key and its own tag agree", () => {
    for (const [tag, descriptor] of Object.entries(WIRES)) {
      expect(descriptor.wire, `${tag} is filed under the wrong key`).toBe(tag);
    }
  });

  test("WIRE_TAGS is derived from WIRES, not a second hand-kept list", () => {
    expect(WIRE_TAGS).toEqual(Object.keys(WIRES));
    expect(WIRE_TAGS).toEqual(["jose", "cose"]);
  });

  test("only COSE keys parameters by integer label", () => {
    // The labelling fact drives every `wireLabel` entry in the registries: a
    // JOSE key is always a string name, a COSE one may be an integer.
    expect(WIRES.jose.labelled).toBe(false);
    expect(WIRES.cose.labelled).toBe(true);

    for (const spec of [...CLAIM_SPECS, ...HEADER_SPECS]) {
      expect(spec.wire.jose.kind, `${spec.domain} is label-keyed on JOSE`).not.toBe(
        "label",
      );
    }
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
