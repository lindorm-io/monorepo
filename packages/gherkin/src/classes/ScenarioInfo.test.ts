import { describe, expect, test } from "vitest";
import { ScenarioInfo } from "./ScenarioInfo.js";

describe("ScenarioInfo", () => {
  test("should assign every field from the settings object", () => {
    const info = new ScenarioInfo({
      featureName: "AES round trip",
      featureUri: "src/features/aes.feature",
      ruleName: "content survives a round trip",
      scenarioName: "every content encryption round-trips",
      tags: ["@integration"],
      examplesRow: [["encryption", "A256GCM"]],
      line: 12,
    });

    expect(info).toMatchSnapshot();
    expect(info.featureName).toEqual("AES round trip");
    expect(info.line).toEqual(12);
  });

  test("should materialize the examplesRow Record from entries in column order", () => {
    const info = new ScenarioInfo({
      featureName: "AES round trip",
      featureUri: "src/features/aes.feature",
      scenarioName: "round-trips A256GCM at $100",
      tags: [],
      examplesRow: [
        ["encryption", "A256GCM"],
        ["price", "$100"],
      ],
      line: 9,
    });

    expect(info.examplesRow).toEqual({ encryption: "A256GCM", price: "$100" });
    expect(Object.keys(info.examplesRow ?? {})).toEqual(["encryption", "price"]);
  });

  test("should keep a __proto__ Examples column as an own property", () => {
    // Control: prove the hazard is real — the same pair in a Record literal
    // loses the key entirely (a non-computed "__proto__" key in an object
    // literal is the prototype-setter form), which is why the settings carry
    // entries.
    const literal = { __proto__: "evil" } as unknown as Record<string, string>;

    expect(Object.hasOwn(literal, "__proto__")).toEqual(false);

    const info = new ScenarioInfo({
      featureName: "hostile",
      featureUri: "src/features/hostile.feature",
      scenarioName: "carries evil",
      tags: [],
      examplesRow: [
        ["__proto__", "evil"],
        ["safe", "value"],
      ],
      line: 7,
    });

    expect(Object.hasOwn(info.examplesRow ?? {}, "__proto__")).toEqual(true);
    expect(info.examplesRow?.["__proto__"]).toEqual("evil");
    expect(info.examplesRow?.safe).toEqual("value");
    // The prototype itself is untouched — the key landed as data.
    expect(Object.getPrototypeOf(info.examplesRow)).toBe(Object.prototype);
  });

  test("should not observe later mutation of the settings tags array", () => {
    const tags = ["@integration"];

    const info = new ScenarioInfo({
      featureName: "AES round trip",
      featureUri: "src/features/aes.feature",
      scenarioName: "every content encryption round-trips",
      tags,
      line: 12,
    });

    tags.push("@added");

    expect(info.tags).toEqual(["@integration"]);
  });

  test("should not change the settings tags array when a consumer mutates info.tags", () => {
    const tags = ["@integration"];

    const info = new ScenarioInfo({
      featureName: "AES round trip",
      featureUri: "src/features/aes.feature",
      scenarioName: "every content encryption round-trips",
      tags,
      line: 12,
    });

    info.tags.push("@added");

    expect(tags).toEqual(["@integration"]);
  });

  test("should leave the optional fields undefined outside a Rule and an Examples row", () => {
    const info = new ScenarioInfo({
      featureName: "AES round trip",
      featureUri: "src/features/aes.feature",
      scenarioName: "default mode",
      tags: [],
      line: 4,
    });

    expect(info.ruleName).toBeUndefined();
    expect(info.examplesRow).toBeUndefined();
  });
});
