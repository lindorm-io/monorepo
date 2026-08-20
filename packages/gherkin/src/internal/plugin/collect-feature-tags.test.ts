import { describe, expect, test } from "vitest";
import { collectFeatureTags } from "./collect-feature-tags.js";

const names = (source: string): Array<string> =>
  collectFeatureTags(source).map((tag) => tag.name);

describe("collectFeatureTags", () => {
  test("should collect tag names from all four levels, @ kept", () => {
    expect(
      names(
        [
          "@top",
          "Feature: tagged",
          "",
          "  @scenario",
          "  Scenario: s",
          "    Given a step",
          "",
          "  @rule",
          "  Rule: r",
          "",
          "    Scenario Outline: o <v>",
          "      Given a <v>",
          "",
          "      @examples",
          "      Examples:",
          "        | v |",
          "        | x |",
        ].join("\n"),
      ),
    ).toEqual(["@top", "@scenario", "@rule", "@examples"]);
  });

  test("should carry each tag's line and column — the scan anchors an invalid name to them", () => {
    expect(
      collectFeatureTags(
        [
          "@top",
          "Feature: tagged",
          "",
          "  @scenario",
          "  Scenario: s",
          "    Given a step",
        ].join("\n"),
      ),
    ).toEqual([
      { column: 1, line: 1, name: "@top" },
      { column: 3, line: 4, name: "@scenario" },
    ]);
  });

  test("should include a tag only a zero-pickle node carries", () => {
    expect(
      names(
        [
          "Feature: hollow",
          "",
          "  Scenario Outline: o <v>",
          "    Given a <v>",
          "",
          "    @zero-rows",
          "    Examples:",
          "      | v |",
        ].join("\n"),
      ),
    ).toEqual(["@zero-rows"]);
  });

  test("should return nothing for a source the parser rejects — the transform owns that failure", () => {
    expect(collectFeatureTags("this line is not gherkin")).toEqual([]);
  });

  test("should return nothing for a source with no feature", () => {
    expect(collectFeatureTags("# only a comment\n")).toEqual([]);
  });
});
