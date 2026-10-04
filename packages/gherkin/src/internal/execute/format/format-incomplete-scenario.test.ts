import { describe, expect, test } from "vitest";
import type { IncompleteScenarioNode } from "../../model/types.js";
import { formatIncompleteScenario } from "./format-incomplete-scenario.js";

const node = (missingKeywords: IncompleteScenarioNode["missingKeywords"]) =>
  ({
    kind: "incomplete-scenario",
    column: 3,
    line: 6,
    missingKeywords,
    name: "never asserts",
    tags: [],
  }) satisfies IncompleteScenarioNode;

describe("formatIncompleteScenario", () => {
  test("should anchor to the scenario line and name a missing Then", () => {
    const message = formatIncompleteScenario(node(["Then"]), "src/features/aes.feature");

    expect(message).toContain("Incomplete scenario");
    expect(message).toContain("  never asserts");
    expect(message).toContain("at src/features/aes.feature:6:3");
    expect(message).toContain("The scenario has no Then step.");
    expect(message).not.toContain("no Given step");
    expect(message).toMatchSnapshot();
  });

  test("should name a missing Given", () => {
    const message = formatIncompleteScenario(node(["Given"]), "src/features/aes.feature");

    expect(message).toContain("The scenario has no Given step.");
    expect(message).not.toContain("no Then step");
  });

  test("should name both keywords when both are missing", () => {
    const message = formatIncompleteScenario(
      node(["Given", "Then"]),
      "src/features/aes.feature",
    );

    expect(message).toContain("The scenario has no Given step and no Then step.");
  });

  test("should say why a * step counts as neither keyword", () => {
    const message = formatIncompleteScenario(
      node(["Given", "Then"]),
      "src/features/aes.feature",
    );

    expect(message).toContain(
      "a * step counts as neither, since it states nothing about which steps assert",
    );
  });
});
