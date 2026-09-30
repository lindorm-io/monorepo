import { describe, expect, test } from "vitest";
import type { Wire } from "./raw-bucket.js";
import { assertNameStatesWire, scenarioWireOf } from "./scenario-wire.js";

const refusalOf = (scenarioName: string, wire: Wire): string => {
  try {
    assertNameStatesWire(scenarioName, wire);
  } catch (error) {
    return (error as Error).message;
  }

  throw new Error(`the ${wire} wire was accepted under the name "${scenarioName}"`);
};

describe("scenarioWireOf", () => {
  test("should read the wire from the name's opening alone, separator included", () => {
    expect({
      "jose: a signed token": scenarioWireOf("jose: a signed token"),
      "cose: a signed token": scenarioWireOf("cose: a signed token"),
      "cose: a jose header rides along": scenarioWireOf(
        "cose: a jose header rides along",
      ),
      "a jose token is signed": scenarioWireOf("a jose token is signed"),
      "jose:a signed token": scenarioWireOf("jose:a signed token"),
      "JOSE: a signed token": scenarioWireOf("JOSE: a signed token"),
    }).toEqual({
      "jose: a signed token": "jose",
      "cose: a signed token": "cose",
      "cose: a jose header rides along": "cose",
      "a jose token is signed": undefined,
      "jose:a signed token": undefined,
      "JOSE: a signed token": undefined,
    });
  });
});

describe("assertNameStatesWire", () => {
  test("should accept the wire the scenario's name states", () => {
    expect(() =>
      assertNameStatesWire("cose: a sealed token round-trips", "cose"),
    ).not.toThrow();
  });

  test("should refuse the wire the scenario's name contradicts, naming both wires", () => {
    const message = refusalOf("jose: a sealed token round-trips", "cose");

    expect(message).toContain("the step acts on the cose wire");
    expect(message).toContain("the scenario states the jose wire");
    expect(message).toContain("jose: a sealed token round-trips");
  });

  test("should refuse a scenario whose name states no wire, naming the scenario", () => {
    const message = refusalOf("a sealed token round-trips", "cose");

    expect(message).toContain("the step acts on the cose wire");
    expect(message).toContain("the scenario states no wire");
    expect(message).toContain("a sealed token round-trips");
  });
});
