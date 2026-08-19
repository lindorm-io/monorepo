import { describe, expect, test } from "vitest";
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
        { column: 5, hasArgument: false, line: 4, text: "an oct key", type: "Context" },
        {
          column: 5,
          hasArgument: false,
          line: 7,
          text: 'I encrypt "hello"',
          type: "Action",
        },
        {
          column: 5,
          hasArgument: false,
          line: 8,
          text: 'decrypting returns "hello"',
          type: "Outcome",
        },
      ]);

      expect(second.line).toBe(10);
      expect(second.steps[0]).toEqual({
        column: 5,
        hasArgument: false,
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
          hasArgument: false,
          line: 4,
          text: "a feature key",
          type: "Context",
        },
        { column: 7, hasArgument: false, line: 9, text: "a rule key", type: "Context" },
        {
          column: 7,
          hasArgument: false,
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
          hasArgument: false,
          line: 4,
          text: 'an oct key with encryption "A128GCM"',
          type: "Context",
        },
        {
          column: 5,
          hasArgument: false,
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
        { kind: "empty-examples", column: 5, line: 4, name: "never expands" },
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
        { kind: "empty-scenario", column: 3, line: 3, name: "no steps" },
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
    test("should flag DocString and DataTable steps with hasArgument", () => {
      const model = asFeature(
        build([
          "Feature: args", // 1
          "",
          "  Scenario: docs", // 3
          "    Given a doc string", // 4
          '      """', // 5
          "      hello body", // 6
          '      """', // 7
          "    And a data table", // 8
          "      | a | b |", // 9
          "    And a plain step", // 10
        ]),
      );

      const scenario = asScenario(model.children[0]);

      expect(scenario.steps).toEqual([
        { column: 5, hasArgument: true, line: 4, text: "a doc string", type: "Context" },
        { column: 5, hasArgument: true, line: 8, text: "a data table", type: "Context" },
        {
          column: 5,
          hasArgument: false,
          line: 10,
          text: "a plain step",
          type: "Context",
        },
      ]);
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
      expect(scenario.steps[0].hasArgument).toBe(true);

      // Pure data: nothing may be lost or altered by the JSON.stringify the
      // transform performs when baking the model into module source.
      expect(JSON.parse(JSON.stringify(model))).toEqual(model);
    });
  });
});
