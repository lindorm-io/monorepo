import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Parser } from "@cucumber/gherkin";
import { afterAll, afterEach, describe, expect, test, vi } from "vitest";
import { readStepTexts } from "./read-step-texts.js";

const ROOT = mkdtempSync(join(tmpdir(), "gherkin-read-step-texts-"));

afterAll(() => {
  rmSync(ROOT, { force: true, recursive: true });
});

const writeFeature = (name: string, lines: Array<string>): string => {
  const path = join(ROOT, name);
  writeFileSync(path, lines.join("\n"));
  return path;
};

describe("readStepTexts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("should merge the Background steps into every scenario, And and But included", () => {
    const file = writeFeature("background.feature", [
      "Feature: Background",
      "",
      "  Background:",
      "    Given the shop is open",
      "    And the till is counted",
      "",
      "  Scenario: buy",
      "    When I buy 3 apples",
      "    But I pay nothing",
      "",
      "  Scenario: browse",
      "    Then I see the shelves",
    ]);

    expect(readStepTexts(file)).toEqual([
      "the shop is open",
      "the till is counted",
      "I buy 3 apples",
      "I pay nothing",
      "the shop is open",
      "the till is counted",
      "I see the shelves",
    ]);
  });

  test("should expand every row of every Examples table, never the unexpanded outline text", () => {
    const file = writeFeature("outline.feature", [
      "Feature: Outline",
      "",
      "  Scenario Outline: pick",
      "    When I pick <colour>",
      "",
      "    Examples:",
      "      | colour |",
      "      | green  |",
      "",
      "    Examples:",
      "      | colour |",
      "      | red    |",
      "      | blue   |",
    ]);

    expect(readStepTexts(file)).toEqual(["I pick green", "I pick red", "I pick blue"]);
  });

  test("should merge a Rule's Background into that Rule's scenarios only", () => {
    const file = writeFeature("rule.feature", [
      "Feature: Rule",
      "",
      "  Background:",
      "    Given the shop is open",
      "",
      "  Scenario: guest",
      "    Then I pay full price",
      "",
      "  Rule: members",
      "",
      "    Background:",
      "      Given I am a member",
      "",
      "    Scenario: discount",
      "      Then I pay less",
    ]);

    expect(readStepTexts(file)).toEqual([
      "the shop is open",
      "I pay full price",
      "the shop is open",
      "I am a member",
      "I pay less",
    ]);
  });

  test("should yield nothing for a Background no scenario follows — it never runs", () => {
    const file = writeFeature("background-only.feature", [
      "Feature: Background only",
      "",
      "  Background:",
      "    Given the shop is open",
    ]);

    expect(readStepTexts(file)).toEqual([]);
  });

  test("should yield nothing for an empty file", () => {
    expect(readStepTexts(writeFeature("empty.feature", []))).toEqual([]);
  });

  test("should yield nothing for a file that does not parse", () => {
    const file = writeFeature("broken.feature", [
      "Feature: Broken",
      "",
      "  Scenario: one",
      "    Given a step in a broken file",
      "",
      "Feature: A second feature in one file",
    ]);

    expect(readStepTexts(file)).toEqual([]);
  });

  test("should yield undefined for a file it cannot read", () => {
    expect(readStepTexts(join(ROOT, "missing.feature"))).toBeUndefined();
  });

  test("should rethrow a parser failure that is not a Gherkin parse error", () => {
    const file = writeFeature("parser-failure.feature", ["Feature: Parser failure"]);
    const failure = new TypeError("parser failure");

    vi.spyOn(Parser.prototype, "parse").mockImplementationOnce(() => {
      throw failure;
    });

    expect(() => readStepTexts(file)).toThrow(failure);
  });
});
