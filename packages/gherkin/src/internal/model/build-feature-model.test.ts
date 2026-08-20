import { parse } from "@cucumber/tag-expressions";
import { describe, expect, test } from "vitest";
import { capture } from "../../__fixtures__/test-helpers.js";
import { buildFeatureModel } from "./build-feature-model.js";
import type {
  EmptyFeatureModel,
  FeatureModel,
  FeatureSuiteModel,
  ParseErrorModel,
  RuleNode,
  ScenarioNode,
  SuiteNode,
} from "./types.js";

const asFeature = (model: FeatureModel): FeatureSuiteModel => {
  if (model.kind === "feature") {
    return model;
  }
  throw new Error(`expected a feature model, got "${model.kind}"`);
};

const asEmpty = (model: FeatureModel): EmptyFeatureModel => {
  if (model.kind === "empty") {
    return model;
  }
  throw new Error(`expected an empty model, got "${model.kind}"`);
};

const asParseError = (model: FeatureModel): ParseErrorModel => {
  if (model.kind === "parse-error") {
    return model;
  }
  throw new Error(`expected a parse-error model, got "${model.kind}"`);
};

const asScenario = (node: SuiteNode): ScenarioNode => {
  if (node.kind === "scenario") {
    return node;
  }
  throw new Error(`expected a scenario node, got "${node.kind}"`);
};

const asRule = (node: SuiteNode): RuleNode => {
  if (node.kind === "rule") {
    return node;
  }
  throw new Error(`expected a rule node, got "${node.kind}"`);
};

// Sources are arrays of lines so every asserted line number is countable in
// the fixture itself (element index + 1).
const build = (lines: Array<string>): FeatureModel =>
  buildFeatureModel(lines.join("\n"), "src/features/test.feature");

// The same matcher shape resolve-settings.ts compiles from the `tags`
// setting — built here from the raw expression so these tests stay on the
// model layer.
const buildSelected = (lines: Array<string>, expression: string): FeatureModel => {
  const node = parse(expression);
  return buildFeatureModel(lines.join("\n"), "src/features/test.feature", (tags) =>
    node.evaluate(tags),
  );
};

describe("buildFeatureModel", () => {
  describe("backgrounds", () => {
    test("should merge a feature-level Background into every scenario, anchored to the Background lines", () => {
      const model = asFeature(
        build([
          "Feature: aes encryption", // 1
          "",
          "  Background:", // 3
          "    Given an oct key", // 4
          "",
          "  Scenario: encrypt", // 6
          '    When I encrypt "hello"', // 7
          '    Then decrypting returns "hello"', // 8
          "",
          "  Scenario: another", // 10
          '    When I encrypt "again"', // 11
        ]),
      );

      expect(model.expectedTests).toBe(2);
      expect(model.line).toBe(1);
      expect(model.name).toBe("aes encryption");

      const [first, second] = model.children.map(asScenario);

      expect(first.line).toBe(6);
      expect(first.column).toBe(3);
      expect(first.steps).toEqual([
        { column: 5, line: 4, text: "an oct key", type: "Context" },
        {
          column: 5,
          line: 7,
          text: 'I encrypt "hello"',
          type: "Action",
        },
        {
          column: 5,
          line: 8,
          text: 'decrypting returns "hello"',
          type: "Outcome",
        },
      ]);

      expect(second.line).toBe(10);
      expect(second.steps[0]).toEqual({
        column: 5,
        line: 4,
        text: "an oct key",
        type: "Context",
      });

      expect(model).toMatchSnapshot();
    });

    test("should stack a Rule-level Background onto the feature Background and support the Example synonym", () => {
      const model = asFeature(
        build([
          "Feature: layered backgrounds", // 1
          "",
          "  Background:", // 3
          "    Given a feature key", // 4
          "",
          "  Rule: record mode", // 6
          "",
          "    Background:", // 8
          "      Given a rule key", // 9
          "",
          "    Example: bound aad", // 11
          '      When I encrypt "secret"', // 12
        ]),
      );

      expect(model.expectedTests).toBe(1);

      const rule = asRule(model.children[0]);

      expect(rule.line).toBe(6);
      expect(rule.name).toBe("record mode");

      const scenario = asScenario(rule.children[0]);

      expect(scenario.line).toBe(11);
      expect(scenario.column).toBe(5);
      expect(scenario.name).toBe("bound aad");
      expect(scenario.steps).toEqual([
        {
          column: 5,
          line: 4,
          text: "a feature key",
          type: "Context",
        },
        { column: 7, line: 9, text: "a rule key", type: "Context" },
        {
          column: 7,
          line: 12,
          text: 'I encrypt "secret"',
          type: "Action",
        },
      ]);

      expect(model).toMatchSnapshot();
    });
  });

  describe("ordering", () => {
    // The grammar puts every feature-level scenario BEFORE the first Rule
    // (Feature := FeatureHeader Background? ScenarioDefinition* Rule*) — a
    // scenario written after a Rule belongs to that Rule regardless of
    // indentation. The model preserves that authored order.
    test("should preserve source order across scenarios and Rules", () => {
      const model = asFeature(
        build([
          "Feature: order", // 1
          "",
          "  Scenario: first", // 3
          "    Given a step", // 4
          "",
          "  Rule: grouped", // 6
          "    Scenario: second", // 7
          "      Given a step", // 8
          "",
          "  Rule: last", // 10
          "    Scenario: third", // 11
          "      Given a step", // 12
        ]),
      );

      expect(model.children.map((node) => node.kind)).toEqual([
        "scenario",
        "rule",
        "rule",
      ]);
      expect(model.children.map((node) => node.name)).toEqual([
        "first",
        "grouped",
        "last",
      ]);
      expect(asRule(model.children[2]).children.map((node) => node.name)).toEqual([
        "third",
      ]);
      expect(model.expectedTests).toBe(3);
    });
  });

  describe("outlines", () => {
    const outline = [
      "Feature: outline", // 1
      "",
      "  Scenario Outline: round-trips <enc> at <price>", // 3
      '    Given an oct key with encryption "<enc>"', // 4
      '    Then the price is "<price>"', // 5
      "",
      "    Examples: fast", // 7
      "      | enc     | price |", // 8
      "      | A128GCM | $100  |", // 9
      "      | A256GCM | $250  |", // 10
      "",
      "    Examples: slow", // 12
      "      | enc           | price |", // 13
      "      | A256CBC-HS512 | $9    |", // 14
    ];

    test("should emit one scenario node per Examples row with substituted names and row lines", () => {
      const model = asFeature(build(outline));

      expect(model.expectedTests).toBe(3);

      const rows = model.children.map(asScenario);

      // `$` in a cell value must survive verbatim — the reason test.for was
      // retired in favour of one test() per pickle.
      expect(rows.map((row) => row.name)).toEqual([
        "round-trips A128GCM at $100",
        "round-trips A256GCM at $250",
        "round-trips A256CBC-HS512 at $9",
      ]);
      expect(rows.map((row) => row.line)).toEqual([9, 10, 14]);
      // Row anchors point at the row's leading `|`.
      expect(rows.map((row) => row.column)).toEqual([7, 7, 7]);
      expect(rows[0].steps).toEqual([
        {
          column: 5,
          line: 4,
          text: 'an oct key with encryption "A128GCM"',
          type: "Context",
        },
        {
          column: 5,
          line: 5,
          text: 'the price is "$100"',
          type: "Outcome",
        },
      ]);

      expect(model).toMatchSnapshot();
    });

    test("should produce identical models for identical input", () => {
      expect(build(outline)).toEqual(build(outline));
    });

    test("should fail an Examples block with a header and zero data rows, anchored to the Examples line", () => {
      const model = asFeature(
        build([
          "Feature: partial outline", // 1
          "",
          "  Scenario Outline: uses <x>", // 3
          "    Given a <x>", // 4
          "",
          "    Examples: empty", // 6
          "      | x |", // 7
          "",
          "    Examples: full", // 9
          "      | x     |", // 10
          "      | value |", // 11
        ]),
      );

      expect(model.expectedTests).toBe(2);
      expect(model.children[0]).toEqual({
        kind: "empty-examples",
        column: 5,
        line: 6,
        name: "uses <x>",
        tags: [],
      });

      const row = asScenario(model.children[1]);

      expect(row.name).toBe("uses value");
      expect(row.line).toBe(11);
      expect(row.column).toBe(7);

      expect(model).toMatchSnapshot();
    });

    test("should fail an Examples block with no table at all", () => {
      const model = asFeature(
        build([
          "Feature: bare examples", // 1
          "  Scenario Outline: never expands", // 2
          "    Given a <x>", // 3
          "    Examples:", // 4
        ]),
      );

      expect(model.expectedTests).toBe(1);
      expect(model.children).toEqual([
        { kind: "empty-examples", column: 5, line: 4, name: "never expands", tags: [] },
      ]);
    });
  });

  describe("empty scenarios", () => {
    test("should fail a zero-step scenario even when a Background exists", () => {
      const model = asFeature(
        build([
          "Feature: gaps", // 1
          "",
          "  Background:", // 3
          "    Given a key", // 4
          "",
          "  Scenario: nothing here", // 6
          "",
          "  Scenario: real", // 8
          "    When acting", // 9
        ]),
      );

      expect(model.expectedTests).toBe(2);

      // compile() does NOT merge the Background into a zero-step scenario —
      // its pickle has zero steps and would report green. The node must be
      // the failing kind, never a scenario carrying the background step.
      expect(model.children[0]).toEqual({
        kind: "empty-scenario",
        column: 3,
        line: 6,
        name: "nothing here",
        tags: [],
      });

      const real = asScenario(model.children[1]);

      expect(real.steps.map((step) => step.line)).toEqual([4, 9]);

      expect(model).toMatchSnapshot();
    });

    test("should fail a zero-step outline once, anchored to the outline line", () => {
      const model = asFeature(
        build([
          "Feature: hollow outline", // 1
          "",
          "  Scenario Outline: no steps", // 3
          "",
          "    Examples:", // 5
          "      | x |", // 6
          "      | 1 |", // 7
          "      | 2 |", // 8
        ]),
      );

      expect(model.expectedTests).toBe(1);
      expect(model.children).toEqual([
        { kind: "empty-scenario", column: 3, line: 3, name: "no steps", tags: [] },
      ]);
    });
  });

  describe("empty features", () => {
    test("should classify a Background-only feature as empty, keeping the name", () => {
      const model = asEmpty(
        build([
          "Feature: background only", // 1
          "  Background:", // 2
          "    Given an unused key", // 3
        ]),
      );

      expect(model).toEqual({
        kind: "empty",
        name: "background only",
        uri: "src/features/test.feature",
      });
    });

    test("should classify a zero-scenario feature as empty", () => {
      const model = asEmpty(build(["Feature: bare", "", "  Just a description."]));

      expect(model.name).toBe("bare");
    });

    test("should classify a feature holding only an empty Rule as empty", () => {
      const model = asEmpty(build(["Feature: shell", "  Rule: nothing"]));

      expect(model.name).toBe("shell");
    });

    test("should classify an empty file as empty with a null name", () => {
      expect(build([""])).toEqual({
        kind: "empty",
        name: null,
        uri: "src/features/test.feature",
      });
    });

    test("should classify a comment-only file as empty with a null name", () => {
      expect(build(["# just a comment", "", "# another"])).toEqual({
        kind: "empty",
        name: null,
        uri: "src/features/test.feature",
      });
    });
  });

  describe("rules", () => {
    test("should omit a Rule holding only a Background", () => {
      const model = asFeature(
        build([
          "Feature: pruned", // 1
          "",
          "  Scenario: real", // 3
          "    Given a step", // 4
          "",
          "  Rule: empty shell", // 6
          "",
          "    Background:", // 8
          "      Given unused", // 9
        ]),
      );

      expect(model.expectedTests).toBe(1);
      expect(model.children.map((node) => node.kind)).toEqual(["scenario"]);
    });
  });

  describe("expected tests", () => {
    test("should count scenario, empty-examples and empty-scenario nodes through Rule nesting", () => {
      const model = asFeature(
        build([
          "Feature: counting", // 1
          "",
          "  Scenario: top", // 3
          "    Given a step", // 4
          "",
          "  Rule: many", // 6
          "",
          "    Scenario: a", // 8
          "      Given a step", // 9
          "",
          "    Scenario: b", // 11
          "      Given a step", // 12
          "",
          "    Scenario Outline: hollow rows", // 14
          "      Given a <x>", // 15
          "      Examples:", // 16
          "        | x |", // 17
          "",
          "    Scenario: empty", // 19
        ]),
      );

      // 2 flat children (scenario + rule), but 5 tests: the count must walk
      // INTO the rule and must count the failing node kinds too.
      expect(model.children).toHaveLength(2);
      expect(asRule(model.children[1]).children.map((node) => node.kind)).toEqual([
        "scenario",
        "scenario",
        "empty-examples",
        "empty-scenario",
      ]);
      expect(model.expectedTests).toBe(5);
    });
  });

  describe("step arguments", () => {
    test("should carry DocString and DataTable CONTENT and omit argument on plain steps", () => {
      const model = asFeature(
        build([
          "Feature: args", // 1
          "",
          "  Scenario: docs", // 3
          "    Given a doc string", // 4
          '      """json', // 5
          '      {"note":"hello body"}', // 6
          '      """', // 7
          "    And a data table", // 8
          "      | a | b |", // 9
          "      | 1 | 2 |", // 10
          "    And a plain step", // 11
        ]),
      );

      const scenario = asScenario(model.children[0]);

      expect(scenario.steps).toEqual([
        {
          argument: {
            kind: "doc-string",
            content: '{"note":"hello body"}',
            mediaType: "json",
          },
          column: 5,
          line: 4,
          text: "a doc string",
          type: "Context",
        },
        {
          argument: {
            kind: "data-table",
            rows: [
              ["a", "b"],
              ["1", "2"],
            ],
          },
          column: 5,
          line: 8,
          text: "a data table",
          type: "Context",
        },
        {
          column: 5,
          line: 11,
          text: "a plain step",
          type: "Context",
        },
      ]);
      // Absent, not undefined — byte-identical emitted source depends on it.
      expect(Object.hasOwn(scenario.steps[2], "argument")).toBe(false);
    });

    test("should substitute Examples values into table cells and DocString bodies", () => {
      // compile() interpolates `<placeholder>` into DocString content and
      // table cells exactly as into step text — the model gets it free from
      // the pickles, pinned here so a regression to AST-sourced content
      // (unsubstituted) goes red.
      const model = asFeature(
        build([
          "Feature: substitution", // 1
          "",
          "  Scenario Outline: row <fruit>", // 3
          "    Given a table of <fruit>", // 4
          "      | name    | price   |", // 5
          "      | <fruit> | <price> |", // 6
          "    And a note about <fruit>", // 7
          '      """', // 8
          "      buy <fruit> for <price>", // 9
          '      """', // 10
          "", // 11
          "    Examples:", // 12
          "      | fruit | price |", // 13
          "      | kiwi  | 9     |", // 14
        ]),
      );

      const scenario = asScenario(model.children[0]);

      expect(scenario.steps[0].argument).toEqual({
        kind: "data-table",
        rows: [
          ["name", "price"],
          ["kiwi", "9"],
        ],
      });
      expect(scenario.steps[1].argument).toEqual({
        kind: "doc-string",
        content: "buy kiwi for 9",
      });
    });

    test("should carry a __proto__ table cell as data", () => {
      const model = asFeature(
        build([
          "Feature: hostile cells", // 1
          "",
          "  Scenario: proto header", // 3
          "    Given a hostile table", // 4
          "      | __proto__ | safe |", // 5
          "      | evil      | ok   |", // 6
        ]),
      );

      expect(asScenario(model.children[0]).steps[0].argument).toEqual({
        kind: "data-table",
        rows: [
          ["__proto__", "safe"],
          ["evil", "ok"],
        ],
      });
    });
  });

  describe("keyword resolution", () => {
    test("should resolve And and But from the preceding step and * to Unknown", () => {
      const model = asFeature(
        build([
          "Feature: keywords", // 1
          "",
          "  Scenario: resolution", // 3
          "    Given a context", // 4
          "    And another context", // 5
          "    When an action", // 6
          "    But another action", // 7
          "    Then an outcome", // 8
          "    * a wildcard", // 9
          "",
          "  Scenario: leading conjunction", // 11
          "    And floating", // 12
        ]),
      );

      const [resolution, leading] = model.children.map(asScenario);

      expect(resolution.steps.map((step) => step.type)).toEqual([
        "Context",
        "Context",
        "Action",
        "Action",
        "Outcome",
        "Unknown",
      ]);
      expect(leading.steps.map((step) => step.type)).toEqual(["Unknown"]);
    });
  });

  describe("dialects", () => {
    test("should parse a # language: header and resolve keyword types", () => {
      const model = asFeature(
        build([
          "# language: fr", // 1
          "Fonctionnalité: chiffrement", // 2
          "  Scénario: aller-retour", // 3
          "    Étant donné une clé", // 4
          '    Quand je chiffre "x"', // 5
          '    Alors le déchiffrement retourne "x"', // 6
        ]),
      );

      expect(model.line).toBe(2);
      expect(model.name).toBe("chiffrement");

      const scenario = asScenario(model.children[0]);

      expect(scenario.name).toBe("aller-retour");
      expect(scenario.line).toBe(3);
      expect(scenario.column).toBe(3);
      expect(scenario.steps.map((step) => step.type)).toEqual([
        "Context",
        "Action",
        "Outcome",
      ]);

      expect(model).toMatchSnapshot();
    });
  });

  describe("parse errors", () => {
    test("should carry every error of a composite parse failure with its location", () => {
      const model = asParseError(
        build([
          "Feature: broken", // 1
          "  Scenario: one", // 2
          "    Given a step", // 3
          "  rogue line", // 4
          "  another rogue", // 5
        ]),
      );

      expect(model.uri).toBe("src/features/test.feature");
      expect(model.errors).toHaveLength(2);
      expect(model.errors[0].line).toBe(4);
      expect(model.errors[0].column).toBe(3);
      expect(model.errors[0].message).toContain("rogue line");
      expect(model.errors[1].line).toBe(5);

      expect(model).toMatchSnapshot();
    });

    test("should carry an unknown # language: header as an anchored parse error", () => {
      const model = asParseError(build(["# language: xx", "Feature: f"]));

      expect(model.errors).toHaveLength(1);
      expect(model.errors[0].line).toBe(1);
      expect(model.errors[0].message).toContain("Language not supported: xx");
    });
  });

  describe("tags", () => {
    const tagged = [
      "@feat", // 1
      "Feature: tagged", // 2
      "",
      "  @plain",
      "  Scenario: plain", // 5
      "    Given a step", // 6
      "",
      "  Scenario Outline: uses <x>", // 8
      "    Given a <x>", // 9
      "",
      "    @fast",
      "    Examples: fast", // 12
      "      | x |", // 13
      "      | 1 |", // 14
      "",
      "    Examples: slow", // 16
      "      | x |", // 17
      "      | 2 |", // 18
      "",
      "  Rule: grouped", // 20
      "",
      "    @ruled",
      "    Scenario: inside", // 23
      "      Given a step", // 24
    ];

    test("should carry each pickle's fully inherited tag set as authored, with the @ prefix", () => {
      const model = asFeature(build(tagged));

      const plain = asScenario(model.children[0]);
      const [fast, slow] = [model.children[1], model.children[2]].map(asScenario);
      const inside = asScenario(asRule(model.children[3]).children[0]);

      expect(plain.tags).toEqual(["@feat", "@plain"]);
      // The examples-level tag reaches only ITS block's row — the wrong
      // source (AST scenario tags) would either drop @fast or leak it into
      // the slow row.
      expect(fast.tags).toEqual(["@feat", "@fast"]);
      expect(slow.tags).toEqual(["@feat"]);
      expect(inside.tags).toEqual(["@feat", "@ruled"]);
    });

    test("should union the feature tags from the pickles, including examples-level tags", () => {
      const model = asFeature(build(tagged));

      // @fast exists on no AST feature/rule/scenario node — only its pickle
      // carries it, so an AST-derived union would lose it.
      expect(model.tags).toEqual(["@feat", "@plain", "@fast", "@ruled"]);
    });

    test("should include a rule-level tag in the feature union via the rule's pickles", () => {
      const model = asFeature(
        build([
          "Feature: rule tagged", // 1
          "",
          "  @grouped",
          "  Rule: grouped", // 4
          "    Scenario: inside", // 5
          "      Given a step", // 6
        ]),
      );

      expect(model.tags).toEqual(["@grouped"]);
      expect(asScenario(asRule(model.children[0]).children[0]).tags).toEqual([
        "@grouped",
      ]);
    });

    test("should deduplicate the feature union but keep a pickle's duplicates as compiled", () => {
      const model = asFeature(
        build([
          "@dup", // 1
          "Feature: duplicated", // 2
          "",
          "  @dup",
          "  Scenario: twice", // 5
          "    Given a step", // 6
        ]),
      );

      // compile() concatenates levels without deduplication — the node stays
      // honest to the pickle; the union is a set.
      expect(asScenario(model.children[0]).tags).toEqual(["@dup", "@dup"]);
      expect(model.tags).toEqual(["@dup"]);
    });

    test("should include a superseded zero-step scenario's tags in the feature union", () => {
      const model = asFeature(
        build([
          "Feature: gaps", // 1
          "",
          "  @orphan",
          "  Scenario: nothing here", // 4
          "",
          "  @real",
          "  Scenario: real", // 7
          "    When acting", // 8
        ]),
      );

      // The zero-step scenario still compiles to a pickle and still runs (as
      // a RED empty-scenario test), so its tags belong in the union.
      expect(model.tags).toEqual(["@orphan", "@real"]);
    });

    test("should carry empty tag arrays for an untagged feature", () => {
      const model = asFeature(
        build([
          "Feature: bare", // 1
          "  Scenario: plain", // 2
          "    Given a step", // 3
        ]),
      );

      expect(model.tags).toEqual([]);
      expect(asScenario(model.children[0]).tags).toEqual([]);
    });
  });

  describe("transform-time selection", () => {
    test("should omit an excluded scenario — it never becomes a node, and expectedTests counts the retained tree", () => {
      const model = asFeature(
        buildSelected(
          [
            "Feature: selected", // 1
            "",
            "  @keep",
            "  Scenario: kept", // 4
            "    Given a step", // 5
            "",
            "  @slow",
            "  Scenario: dropped", // 8
            "    Given a step", // 9
          ],
          "not @slow",
        ),
      );

      // The build SUCCEEDING is the invariant half: the excluded pickle is
      // recorded, so assert-pickle-parity does not fire, and the count is
      // derived from the retained tree alone.
      expect(model.children.map((child) => child.name)).toEqual(["kept"]);
      expect(model.expectedTests).toBe(1);
    });

    test("should select outline rows per EXAMPLES block — the block's tags ride its rows' pickles", () => {
      const model = asFeature(
        buildSelected(
          [
            "Feature: outline selection", // 1
            "",
            "  Scenario Outline: uses <x>", // 3
            "    Given a <x>", // 4
            "",
            "    @fast",
            "    Examples: fast", // 7
            "      | x |", // 8
            "      | 1 |", // 9
            "",
            "    Examples: slow", // 11
            "      | x |", // 12
            "      | 2 |", // 13
          ],
          "not @fast",
        ),
      );

      expect(model.children).toHaveLength(1);
      expect(asScenario(model.children[0]).examplesRow).toEqual([["x", "2"]]);
    });

    test("should fall back to the skipped-suite empty model when EVERY scenario is excluded", () => {
      const model = asEmpty(
        buildSelected(
          [
            "@slow", // 1
            "Feature: fully excluded", // 2
            "",
            "  Scenario: one", // 4
            "    Given a step", // 5
          ],
          "not @slow",
        ),
      );

      expect(model).toEqual({
        kind: "empty",
        name: "fully excluded",
        uri: "src/features/test.feature",
      });
    });

    test("should omit a Rule whose every scenario is excluded — no empty describe", () => {
      const model = asFeature(
        buildSelected(
          [
            "Feature: rule exclusion", // 1
            "",
            "  Scenario: survives", // 3
            "    Given a step", // 4
            "",
            "  @slow",
            "  Rule: all excluded", // 7
            "    Scenario: inside", // 8
            "      Given a step", // 9
          ],
          "not @slow",
        ),
      );

      expect(model.children).toHaveLength(1);
      expect(asScenario(model.children[0]).name).toBe("survives");
      expect(model.expectedTests).toBe(1);
    });

    test("should keep the two zero-test outline cases separate — all-rows-excluded goes QUIET, zero rows stays RED", () => {
      // Both blocks compile to zero retained pickles, so pickles alone
      // cannot tell them apart — only the AST walk can, and it must: one is
      // a legitimate lane exclusion, the other an authoring error.
      const model = asFeature(
        buildSelected(
          [
            "Feature: the separation", // 1
            "",
            "  Scenario Outline: excluded wholesale <x>", // 3
            "    Given a <x>", // 4
            "",
            "    @slow",
            "    Examples:", // 7
            "      | x |", // 8
            "      | 1 |", // 9
            "",
            "  Scenario Outline: zero rows <x>", // 11
            "    Given a <x>", // 12
            "",
            "    Examples:", // 14
            "      | x |", // 15
          ],
          "not @slow",
        ),
      );

      expect(model.children).toEqual([
        {
          kind: "empty-examples",
          column: 5,
          line: 14,
          name: "zero rows <x>",
          tags: [],
        },
      ]);
      expect(model.expectedTests).toBe(1);
    });

    test("should keep a zero-row Examples RED even when the expression excludes its tags — an excludable authoring error would be a skip tag by the back door", () => {
      const model = asFeature(
        buildSelected(
          [
            "Feature: no back door", // 1
            "",
            "  Scenario: survives", // 3
            "    Given a step", // 4
            "",
            "  @slow",
            "  Scenario Outline: broken <x>", // 7
            "    Given a <x>", // 8
            "",
            "    Examples:", // 10
            "      | x |", // 11
          ],
          "not @slow",
        ),
      );

      expect(model.children[1]).toEqual({
        kind: "empty-examples",
        column: 5,
        line: 10,
        name: "broken <x>",
        tags: ["@slow"],
      });
    });

    test("should keep an empty scenario RED when the expression excludes its tags", () => {
      const model = asFeature(
        buildSelected(
          [
            "Feature: no back door", // 1
            "",
            "  Scenario: survives", // 3
            "    Given a step", // 4
            "",
            "  @slow",
            "  Scenario: nothing here", // 7
          ],
          "not @slow",
        ),
      );

      expect(model.children[1]).toEqual({
        kind: "empty-scenario",
        column: 3,
        line: 7,
        name: "nothing here",
        tags: ["@slow"],
      });
    });

    test("should drop excluded pickles' tags from the feature union — a hook gated on them must not fire", () => {
      const model = asFeature(
        buildSelected(
          [
            "Feature: union after exclusion", // 1
            "",
            "  @keep",
            "  Scenario: kept", // 4
            "    Given a step", // 5
            "",
            "  @slow @docker",
            "  Scenario: dropped", // 8
            "    Given a step", // 9
          ],
          "not @slow",
        ),
      );

      expect(model.tags).toEqual(["@keep"]);
    });
  });

  describe("failing-node inherited tags", () => {
    test("should give an empty-examples node the AST-inherited tags of all four levels", () => {
      const model = asFeature(
        build([
          "@feat", // 1
          "Feature: inherited", // 2
          "",
          "  @ruled",
          "  Rule: grouped", // 5
          "",
          "    @lined",
          "    Scenario Outline: hollow <x>", // 8
          "      Given a <x>", // 9
          "",
          "      @exampled",
          "      Examples:", // 12
          "        | x |", // 13
        ]),
      );

      expect(asRule(model.children[0]).children[0]).toEqual({
        kind: "empty-examples",
        column: 7,
        line: 12,
        name: "hollow <x>",
        tags: ["@feat", "@ruled", "@lined", "@exampled"],
      });
    });

    test("should give a zero-step OUTLINE's empty-scenario node its Examples-level tags too", () => {
      // ONE node stands in for every row of the outline, so it must carry
      // what those rows would have carried — a row-level tag dropped here
      // makes the red invisible under a --tagsFilter for its own lane.
      const model = asFeature(
        build([
          "@feat", // 1
          "Feature: hollow outline", // 2
          "",
          "  @lined",
          "  Scenario Outline: no steps <x>", // 5
          "",
          "    @first",
          "    Examples:", // 8
          "      | x |", // 9
          "      | 1 |", // 10
          "",
          "    @second",
          "    Examples:", // 13
          "      | x |", // 14
          "      | 2 |", // 15
        ]),
      );

      expect(model.children).toEqual([
        {
          kind: "empty-scenario",
          column: 3,
          line: 5,
          name: "no steps <x>",
          tags: ["@feat", "@lined", "@first", "@second"],
        },
      ]);
    });

    test("should give an empty-scenario node the AST-inherited feature, rule and scenario tags", () => {
      const model = asFeature(
        build([
          "@feat", // 1
          "Feature: inherited", // 2
          "",
          "  @ruled",
          "  Rule: grouped", // 5
          "",
          "    @lined",
          "    Scenario: nothing here", // 8
        ]),
      );

      expect(asRule(model.children[0]).children[0]).toEqual({
        kind: "empty-scenario",
        column: 5,
        line: 8,
        name: "nothing here",
        tags: ["@feat", "@ruled", "@lined"],
      });
    });
  });

  describe("reserved tags", () => {
    test("should fail the transform with unsupported_tag through the public door", () => {
      const error = capture(() =>
        build([
          "Feature: reserved", // 1
          "",
          "  @skip",
          "  Scenario: from another runner", // 4
          "    Given a step", // 5
        ]),
      );

      expect(error.code).toBe("unsupported_tag");
      expect(error.message).toContain(
        "this runner has no skip tag — exclude via `tags` in config",
      );
      expect(error.message).toContain("at src/features/test.feature:3:3");
    });

    test("should fail the transform with invalid_tag_name — the backstop for a file the config-time scan did not cover", () => {
      const error = capture(() =>
        build([
          "Feature: invalid name", // 1
          "",
          "  @issue(1234)",
          "  Scenario: a real Cucumber convention", // 4
          "    Given a step", // 5
        ]),
      );

      expect(error.code).toBe("invalid_tag_name");
      expect(error.message).toContain("at src/features/test.feature:3:3");
    });

    test("should reject a reserved tag even on a scenario the tags expression excludes — never silently inert", () => {
      const error = capture(() =>
        buildSelected(
          [
            "Feature: reserved", // 1
            "",
            "  @slow @concurrent",
            "  Scenario: excluded anyway", // 4
            "    Given a step", // 5
          ],
          "not @slow",
        ),
      );

      expect(error.code).toBe("unsupported_tag");
      expect(error.message).toContain("concurrency is not supported");
    });
  });

  describe("rule names", () => {
    test("should name the enclosing Rule on its scenarios and leave top-level scenarios bare", () => {
      const model = asFeature(
        build([
          "Feature: named", // 1
          "",
          "  Scenario: top", // 3
          "    Given a step", // 4
          "",
          "  Rule: first rule", // 6
          "    Scenario: inside first", // 7
          "      Given a step", // 8
          "",
          "  Rule: second rule", // 10
          "    Scenario Outline: inside second <x>", // 11
          "      Given a <x>", // 12
          "      Examples:", // 13
          "        | x |", // 14
          "        | 1 |", // 15
        ]),
      );

      const top = asScenario(model.children[0]);
      const insideFirst = asScenario(asRule(model.children[1]).children[0]);
      const insideSecond = asScenario(asRule(model.children[2]).children[0]);

      // Absent, not empty — a top-level scenario has no enclosing Rule even
      // when Rules exist elsewhere in the feature.
      expect(Object.hasOwn(top, "ruleName")).toBe(false);
      expect(insideFirst.ruleName).toEqual("first rule");
      expect(insideSecond.ruleName).toEqual("second rule");
    });
  });

  describe("examples rows", () => {
    test("should pair each row's values against the header in column order", () => {
      const model = asFeature(
        build([
          "Feature: pairs", // 1
          "",
          "  Scenario Outline: <alg> at <price> for <tenant>", // 3
          '    Given "<alg>" and "<price>" and "<tenant>"', // 4
          "",
          "    Examples:", // 6
          "      | alg     | price | tenant |", // 7
          "      | A128GCM | $100  | t-1    |", // 8
          "      | A256GCM | $250  | t-2    |", // 9
        ]),
      );

      const [first, second] = model.children.map(asScenario);

      // Distinct values per column: an off-by-one pairing cannot pass.
      expect(first.examplesRow).toEqual([
        ["alg", "A128GCM"],
        ["price", "$100"],
        ["tenant", "t-1"],
      ]);
      expect(second.examplesRow).toEqual([
        ["alg", "A256GCM"],
        ["price", "$250"],
        ["tenant", "t-2"],
      ]);
    });

    test("should pair against the OWN Examples block's header when headers differ", () => {
      const model = asFeature(
        build([
          "Feature: split headers", // 1
          "",
          "  Scenario Outline: <a><b>", // 3
          "    Given <a> and <b>", // 4
          "",
          "    Examples: ab", // 6
          "      | a | b |", // 7
          "      | 1 | 2 |", // 8
          "",
          "    Examples: ba", // 10
          "      | b | a |", // 11
          "      | 3 | 4 |", // 12
        ]),
      );

      const [ab, ba] = model.children.map(asScenario);

      expect(ab.examplesRow).toEqual([
        ["a", "1"],
        ["b", "2"],
      ]);
      expect(ba.examplesRow).toEqual([
        ["b", "3"],
        ["a", "4"],
      ]);
    });

    test("should leave examplesRow absent on a plain scenario", () => {
      const model = asFeature(
        build([
          "Feature: plain", // 1
          "  Scenario: no rows", // 2
          "    Given a step", // 3
        ]),
      );

      expect(Object.hasOwn(asScenario(model.children[0]), "examplesRow")).toBe(false);
    });

    test("should carry a __proto__ header column as a plain entry", () => {
      const model = asFeature(
        build([
          "Feature: hostile column", // 1
          "",
          "  Scenario Outline: reads <safe>", // 3
          "    Given a <safe>", // 4
          "",
          "    Examples:", // 6
          "      | __proto__ | safe |", // 7
          "      | evil      | ok   |", // 8
        ]),
      );

      // Entries, not a Record — a Record would lose the key when the baked
      // module literal is evaluated (pinned end to end:
      // gherkin-plugin.test.ts "__proto__ Examples column").
      expect(asScenario(model.children[0]).examplesRow).toEqual([
        ["__proto__", "evil"],
        ["safe", "ok"],
      ]);
    });
  });

  describe("hostile content", () => {
    test("should carry backticks, interpolation markers and quotes verbatim and survive a JSON round trip", () => {
      const model = asFeature(
        build([
          'Feature: hostile ` ${so} "quoted"', // 1
          "",
          '  Scenario: carries ` and ${payload} and "quotes"', // 3
          '    Given a step with "`${danger}`" inside', // 4
          '      """', // 5
          "      body with ` backtick, ${injection}, \"double\" and 'single' quotes", // 6
          '      """', // 7
        ]),
      );

      expect(model.name).toBe('hostile ` ${so} "quoted"');

      const scenario = asScenario(model.children[0]);

      expect(scenario.name).toBe('carries ` and ${payload} and "quotes"');
      expect(scenario.steps[0].text).toBe('a step with "`${danger}`" inside');
      expect(scenario.steps[0].argument).toEqual({
        kind: "doc-string",
        content: "body with ` backtick, ${injection}, \"double\" and 'single' quotes",
      });

      // Pure data: nothing may be lost or altered by the JSON.stringify the
      // transform performs when baking the model into module source.
      expect(JSON.parse(JSON.stringify(model))).toEqual(model);
    });
  });
});
