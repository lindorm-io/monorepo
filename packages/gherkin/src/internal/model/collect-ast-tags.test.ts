import { AstBuilder, GherkinClassicTokenMatcher, Parser } from "@cucumber/gherkin";
import type { Feature } from "@cucumber/messages";
import { IdGenerator } from "@cucumber/messages";
import { isObject } from "@lindorm/is";
import { describe, expect, test } from "vitest";
import { collectAstTags } from "./collect-ast-tags.js";

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

describe("collectAstTags", () => {
  test("should collect tags from all four taggable levels with locations, in document order", () => {
    const feature = parseFeature(
      [
        "@feature-level",
        "Feature: tagged everywhere",
        "",
        "  @scenario-level",
        "  Scenario: plain",
        "    Given a step",
        "",
        "  Scenario Outline: outline <v>",
        "    Given a <v>",
        "",
        "    @examples-level",
        "    Examples:",
        "      | v |",
        "      | x |",
        "",
        "  @rule-level",
        "  Rule: grouped",
        "",
        "    @rule-scenario-level",
        "    Scenario: inside",
        "      Given a step",
        "",
        "    Scenario Outline: inner <v>",
        "      Given a <v>",
        "",
        "      @rule-examples-level",
        "      Examples:",
        "        | v |",
        "        | y |",
      ].join("\n"),
    );

    expect(collectAstTags(feature)).toMatchSnapshot();
  });

  test("should return nothing for an untagged feature — a Background cannot carry tags", () => {
    const feature = parseFeature(
      [
        "Feature: untagged",
        "",
        "  Background:",
        "    Given a shared step",
        "",
        "  Scenario: plain",
        "    Given a step",
      ].join("\n"),
    );

    expect(collectAstTags(feature)).toEqual([]);
  });

  test("should include tags on nodes that compile to ZERO pickles — the AST superset", () => {
    const feature = parseFeature(
      [
        "Feature: zero pickles",
        "",
        "  Scenario Outline: hollow",
        "    Given a <v>",
        "",
        "    @only-here",
        "    Examples:",
        "      | v |",
      ].join("\n"),
    );

    expect(collectAstTags(feature).map((tag) => tag.name)).toEqual(["@only-here"]);
  });
});
