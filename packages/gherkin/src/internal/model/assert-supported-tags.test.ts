import { AstBuilder, GherkinClassicTokenMatcher, Parser } from "@cucumber/gherkin";
import type { Feature } from "@cucumber/messages";
import { IdGenerator } from "@cucumber/messages";
import { isObject } from "@lindorm/is";
import { describe, expect, test } from "vitest";
import { capture, errorShape } from "../../__fixtures__/test-helpers.js";
import { assertSupportedTags } from "./assert-supported-tags.js";
import { collectAstTags } from "./collect-ast-tags.js";

const uri = "src/features/tags.feature";

const parseFeature = (source: string): Feature => {
  const parser = new Parser(
    new AstBuilder(IdGenerator.incrementing()),
    new GherkinClassicTokenMatcher(),
  );
  const document = parser.parse(source);

  if (isObject(document.feature)) {
    return document.feature;
  }

  throw new Error("source parsed to no feature");
};

const scenarioTagged = (tag: string): Feature =>
  parseFeature(
    [
      "Feature: reserved",
      "",
      `  ${tag}`,
      "  Scenario: carries a reserved tag",
      "    Given a step",
    ].join("\n"),
  );

describe("assertSupportedTags", () => {
  test.each(["@concurrent", "@sequential"])(
    "should reject %s — concurrency is not supported",
    (tag) => {
      const error = capture(() =>
        assertSupportedTags(collectAstTags(scenarioTagged(tag)), uri),
      );

      expect(error.code).toBe("unsupported_tag");
      expect(error.message).toContain("concurrency is not supported");
      expect(error.message).toContain(`  ${tag}`);
      expect(error.message).toContain(`at ${uri}:3:3`);
    },
  );

  test.each(["@skip", "@ignore", "@todo", "@fails"])(
    "should reject %s — this runner has no skip tag",
    (tag) => {
      const error = capture(() =>
        assertSupportedTags(collectAstTags(scenarioTagged(tag)), uri),
      );

      expect(error.code).toBe("unsupported_tag");
      expect(error.message).toContain(
        "this runner has no skip tag — exclude via `tags` in config",
      );
      expect(error.message).toContain(`at ${uri}:3:3`);
    },
  );

  test("should carry the full house error shape, anchored to the tag's own line", () => {
    const error = capture(() =>
      assertSupportedTags(collectAstTags(scenarioTagged("@skip")), uri),
    );

    expect(error.data).toEqual({ column: 3, line: 3, tag: "@skip", uri });
    expect(errorShape(error)).toMatchSnapshot();
  });

  test("should reject a reserved tag at FEATURE level", () => {
    const feature = parseFeature(
      ["@concurrent", "Feature: reserved", "", "  Scenario: s", "    Given a step"].join(
        "\n",
      ),
    );

    const error = capture(() => assertSupportedTags(collectAstTags(feature), uri));

    expect(error.code).toBe("unsupported_tag");
    expect(error.message).toContain(`at ${uri}:1:1`);
  });

  test("should reject a reserved tag at RULE level", () => {
    const feature = parseFeature(
      [
        "Feature: reserved",
        "",
        "  @ignore",
        "  Rule: grouped",
        "",
        "    Scenario: s",
        "      Given a step",
      ].join("\n"),
    );

    const error = capture(() => assertSupportedTags(collectAstTags(feature), uri));

    expect(error.code).toBe("unsupported_tag");
    expect(error.data).toEqual({ column: 3, line: 3, tag: "@ignore", uri });
  });

  test("should reject a reserved tag at EXAMPLES level — zero-pickle nodes included", () => {
    // Zero data rows: the block compiles to NO pickle, so only the AST walk
    // can see this tag — the reason the check reads the AST, never pickles.
    const feature = parseFeature(
      [
        "Feature: reserved",
        "",
        "  Scenario Outline: outline <v>",
        "    Given a <v>",
        "",
        "    @todo",
        "    Examples:",
        "      | v |",
      ].join("\n"),
    );

    const error = capture(() => assertSupportedTags(collectAstTags(feature), uri));

    expect(error.code).toBe("unsupported_tag");
    expect(error.data).toEqual({ column: 5, line: 6, tag: "@todo", uri });
  });

  test("should accept every non-reserved tag — including near-misses", () => {
    const feature = parseFeature(
      [
        "@wip @skipped @concurrency @slow",
        "Feature: fine",
        "",
        "  Scenario: s",
        "    Given a step",
      ].join("\n"),
    );

    expect(() => assertSupportedTags(collectAstTags(feature), uri)).not.toThrow();
  });
});
