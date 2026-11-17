import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Linter } from "eslint";
import { RuleTester } from "eslint";
import tseslint from "typescript-eslint";
import { afterAll, describe, test, vi } from "vitest";
import { noUnreachedStep } from "./no-unreached-step.js";

RuleTester.describe = describe;
RuleTester.it = test;
RuleTester.itOnly = test.only;

// A real path: fdir skips a symlinked directory whose target lies under the target of a
// symlinked ancestor it crawled through, and macOS tmpdir() sits under one (`/var`,
// `/tmp`).
const ROOT = realpathSync(mkdtempSync(join(tmpdir(), "gherkin-no-unreached-step-")));

afterAll(() => {
  chmodSync(join(ROOT, "unsearchable", "locked"), 0o755);
  rmSync(ROOT, { force: true, recursive: true });
});

// RuleTester constructs its Linter without a `cwd`, and the Linter reads process.cwd() once, in
// its constructor (eslint/lib/linter/linter.js `normalizeCwd`).
const ruleTesterAt = (cwd: string, config: Linter.Config): RuleTester => {
  const workingDirectory = vi.spyOn(process, "cwd").mockReturnValue(cwd);
  const tester = new RuleTester(config);

  workingDirectory.mockRestore();

  return tester;
};

const scenario = (step: string): Array<string> => [
  "Feature: Project",
  "",
  "  Scenario: project",
  `    Given ${step}`,
];

const writeTree = (name: string, files: Record<string, Array<string>>): string => {
  for (const [file, lines] of Object.entries(files)) {
    const path = join(ROOT, name, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, lines.join("\n"));
  }

  return join(ROOT, name);
};

const SHOP = writeTree("shop", {
  "shop.feature": [
    "Feature: Shop",
    "",
    "  Background:",
    "    Given the shop is open",
    "",
    "  Scenario: buy apples",
    "    When I buy 3 apples",
    "    Then the basket holds apples",
    "",
    "  Scenario Outline: pick a colour",
    "    When I pick <colour>",
    "    Then the colour is noted",
    "",
    "    Examples:",
    "      | colour |",
    "      | green  |",
    "",
    "    Examples:",
    "      | colour |",
    "      | red    |",
    "      | blue   |",
  ],
  "nested.feature/aisle.feature": [
    "Feature: Aisle",
    "",
    "  Scenario: walk",
    "    Given I walk the aisle",
  ],
});

const COUNT = writeTree("count", {
  "count.feature": [
    "Feature: Count",
    "",
    "  Scenario: count in words",
    "    When I count three apples",
  ],
});

const BROKEN = writeTree("broken", {
  "sound.feature": [
    "Feature: Sound",
    "",
    "  Scenario: sound",
    "    Given the sound step",
  ],
  "broken.feature": [
    "Feature: Broken",
    "",
    "  Scenario: one",
    "    Given a step in a broken file",
    "",
    "Feature: A second feature in one file",
  ],
});

const DANGLING = writeTree("dangling", {
  "sound.feature": [
    "Feature: Sound",
    "",
    "  Scenario: sound",
    "    Given the sound step",
  ],
});

symlinkSync(join(DANGLING, "gone.feature"), join(DANGLING, "dangling.feature"));

const DOTTED = writeTree("dotted", {
  "src/.dot.feature": [
    "Feature: Dot",
    "",
    "  Scenario: dot",
    "    Given the dot-named file step",
  ],
  "src/.drafts/d.feature": [
    "Feature: Draft",
    "",
    "  Scenario: draft",
    "    Given the dot-named directory step",
  ],
});

const LINKED = writeTree("linked", {
  "shared/shared.feature": [
    "Feature: Shared",
    "",
    "  Scenario: shared",
    "    Given the linked directory step",
  ],
});

mkdirSync(join(LINKED, "src"));
symlinkSync(join(LINKED, "shared"), join(LINKED, "src", "linked"), "dir");

const DIRECTORY = writeTree("directory", {
  "src/features/listed.feature": [
    "Feature: Listed",
    "",
    "  Scenario: listed",
    "    Given the directory step",
  ],
});

const LOOPING = writeTree("looping", {
  "sound.feature": [
    "Feature: Sound",
    "",
    "  Scenario: sound",
    "    Given the sound step",
  ],
});

symlinkSync(join(LOOPING, "loop.feature"), join(LOOPING, "loop.feature"));

const UNREADABLE = writeTree("unreadable", {
  "sound.feature": [
    "Feature: Sound",
    "",
    "  Scenario: sound",
    "    Given the sound step",
  ],
  "sealed.feature": [
    "Feature: Sealed",
    "",
    "  Scenario: sealed",
    "    Given the sealed step",
  ],
});

chmodSync(join(UNREADABLE, "sealed.feature"), 0o000);

const UNSEARCHABLE = writeTree("unsearchable", {
  "sound.feature": [
    "Feature: Sound",
    "",
    "  Scenario: sound",
    "    Given the sound step",
  ],
  "locked/hidden.feature": [
    "Feature: Hidden",
    "",
    "  Scenario: hidden",
    "    Given the hidden step",
  ],
});

chmodSync(join(UNSEARCHABLE, "locked"), 0o444);

const SEPARATED = writeTree("separated", {
  "note.feature": [
    "Feature: Note",
    "",
    "  Scenario: a note across a line separator",
    "    Given the note reads one\u2028two",
  ],
});

const PROJECT = writeTree("project", {
  "src/a.feature": scenario("the suite step"),
  "src/k.wip.feature": scenario("the wip step"),
  "src/node_modules/n.feature": scenario("the node_modules directory step"),
  "src/dist/d.feature": scenario("the dist directory step"),
  "src/coverage/c.feature": scenario("the coverage directory step"),
});

writeTree("outside", { "o.feature": scenario("the outside step") });

const IMPORTS =
  'import { Binding, Given, ParameterType, Then, When } from "@lindorm/gherkin";';

const steps = (...members: Array<string>): string =>
  [IMPORTS, "", "@Binding()", "export class ShopSteps {", ...members, "}"].join("\n");

const features = (dir: string): Array<string> => [`${dir}/**/*.feature`];

const srcFeatures = (dir: string): Array<string> => [`${dir}/src/**/*.feature`];

const SHOP_OPTIONS = [{ features: features(SHOP) }];

const unreached = (expression: string) => ({
  messageId: "unreached",
  data: { expression },
});

ruleTesterAt(ROOT, {
  languageOptions: { parser: tseslint.parser },
}).run("no-unreached-step", noUnreachedStep, {
  valid: [
    {
      name: "reports nothing for a step a scenario step matches",
      code: steps('  @When("I buy 3 apples") buy(): void {}'),
      options: SHOP_OPTIONS,
    },
    {
      name: "reports nothing for a step reached only through the last row of a later Examples table",
      code: steps('  @When("I pick blue") pickBlue(): void {}'),
      options: SHOP_OPTIONS,
    },
    {
      name: "reports nothing for a step reached only through a Background",
      code: steps('  @Given("the shop is open") open(): void {}'),
      options: SHOP_OPTIONS,
    },
    {
      name: "reports nothing for a step reached only from a feature file inside a directory named like one",
      code: steps('  @Given("I walk the aisle") walk(): void {}'),
      options: SHOP_OPTIONS,
    },
    {
      name: "reports nothing for a step whose built-in parameter type matches the scenario text",
      code: steps('  @When("I buy {int} apples") buy(count: number): void {}'),
      options: SHOP_OPTIONS,
    },
    {
      name: "reports nothing for a step reached through a literal @ParameterType declared in the file",
      code: steps(
        '  @When("I pick {hue}") pick(hue: string): void {}',
        '  @ParameterType("hue", /red|blue/) static hue(raw: string): string { return raw; }',
      ),
      options: SHOP_OPTIONS,
    },
    {
      name: "reports nothing for a step whose parameter type the file does not declare",
      code: steps('  @When("I pick {shade}") pick(shade: string): void {}'),
      options: SHOP_OPTIONS,
    },
    {
      name: "lets an undeclared parameter type match a line separator in the scenario text",
      code: steps('  @Given("the note reads {note}") note(note: string): void {}'),
      options: [{ features: features(SEPARATED) }],
    },
    {
      name: "reports nothing for a step whose parameter type regexp is computed",
      code: steps(
        '  @When("I pick {tone}") pick(tone: string): void {}',
        '  @ParameterType("tone", new RegExp("never")) static tone(raw: string): string { return raw; }',
      ),
      options: SHOP_OPTIONS,
    },
    {
      name: "reports nothing for a step whose @ParameterType regexp array holds a computed entry",
      code: steps(
        '  @When("I pick {metal}") pick(metal: string): void {}',
        '  @ParameterType("metal", [/gold/, new RegExp("silver")]) static metal(raw: string): string { return raw; }',
      ),
      options: SHOP_OPTIONS,
    },
    {
      name: "reports nothing for a step whose literal @ParameterType sits on a class @Binding never registers",
      code: [
        IMPORTS,
        "",
        "export class Unregistered {",
        '  @ParameterType("mood", /never/) static mood(raw: string): string { return raw; }',
        "}",
        "",
        "@Binding()",
        "export class ShopSteps {",
        '  @When("I pick {mood}") pick(mood: string): void {}',
        "}",
      ].join("\n"),
      options: SHOP_OPTIONS,
    },
    {
      name: "keeps cucumber's built-in parameter type when the file redeclares its name",
      code: steps(
        '  @When("I buy {int} apples") buy(count: number): void {}',
        '  @ParameterType("int", /never/) static int(raw: string): string { return raw; }',
      ),
      options: SHOP_OPTIONS,
    },
    {
      name: "reports nothing for a step whose @ParameterType regexp carries a flag cucumber refuses",
      code: steps(
        '  @When("I pick {metal}") pick(metal: string): void {}',
        '  @ParameterType("metal", /gold/g) static metal(raw: string): string { return raw; }',
      ),
      options: SHOP_OPTIONS,
    },
    {
      name: "skips a step whose expression is a variable",
      code: [
        IMPORTS,
        "",
        'const EXPRESSION = "nobody writes this";',
        "",
        "@Binding()",
        "export class ShopSteps {",
        "  @Given(EXPRESSION) never(): void {}",
        "}",
      ].join("\n"),
      options: SHOP_OPTIONS,
    },
    {
      name: "skips a step whose expression is a template with expressions",
      code: steps('  @Given(`nobody ${"writes"} this`) never(): void {}'),
      options: SHOP_OPTIONS,
    },
    {
      name: "skips a step whose expression cucumber cannot compile",
      code: steps('  @Given("I have ({int}) apples") never(): void {}'),
      options: SHOP_OPTIONS,
    },
    {
      name: "skips a step whose parameter type name cucumber refuses",
      code: steps('  @Given("I pick {a.b}") never(): void {}'),
      options: SHOP_OPTIONS,
    },
    {
      name: "skips a step decorator called without an expression",
      code: steps("  @Given() never(): void {}"),
      options: SHOP_OPTIONS,
    },
    {
      name: "skips a @ParameterType called without a name",
      code: steps(
        '  @When("I pick {colour}") pick(colour: string): void {}',
        "  @ParameterType() static colour(raw: string): string { return raw; }",
      ),
      options: SHOP_OPTIONS,
    },
    {
      name: "reads no export name from a computed namespace member",
      code: [
        'import * as gherkin from "@lindorm/gherkin";',
        "",
        'const When = "ParameterType";',
        "",
        "@gherkin.Binding()",
        "export class ShopSteps {",
        '  @(gherkin[When])("colour", /never/) static colour(raw: string): string { return raw; }',
        "}",
      ].join("\n"),
      options: SHOP_OPTIONS,
    },
    {
      name: "reads no decorator another library exports under the same name",
      code: [
        'import { Given } from "another-bdd-library";',
        "",
        "export class ShopSteps {",
        '  @Given("nobody writes this") never(): void {}',
        "}",
      ].join("\n"),
      options: SHOP_OPTIONS,
    },
    {
      name: "keeps reading the feature files that parse when another does not",
      code: steps('  @Given("the sound step") sound(): void {}'),
      options: [{ features: features(BROKEN) }],
    },
    {
      name: "keeps reading the feature files beside a dangling feature symlink",
      code: steps('  @Given("the sound step") sound(): void {}'),
      options: [{ features: features(DANGLING) }],
    },
    {
      name: "keeps reading the feature files beside a self-looping feature symlink",
      code: steps('  @Given("the sound step") sound(): void {}'),
      options: [{ features: features(LOOPING) }],
    },
    {
      name: "keeps reading the feature files beside one it cannot read",
      code: steps('  @Given("the sound step") sound(): void {}'),
      options: [{ features: features(UNREADABLE) }],
    },
    {
      name: "keeps reading the feature files beside a directory it cannot search",
      code: steps('  @Given("the sound step") sound(): void {}'),
      options: [{ features: features(UNSEARCHABLE) }],
    },
    {
      name: "reports nothing for a step reached only from a dot-named feature file",
      code: steps('  @Given("the dot-named file step") dot(): void {}'),
      options: [{ features: srcFeatures(DOTTED) }],
    },
    {
      name: "reports nothing for a step reached only from a feature file in a dot-named directory",
      code: steps('  @Given("the dot-named directory step") draft(): void {}'),
      options: [{ features: srcFeatures(DOTTED) }],
    },
    {
      name: "reports nothing for a step reached only through a symlinked directory",
      code: steps('  @Given("the linked directory step") linked(): void {}'),
      options: [{ features: srcFeatures(LINKED) }],
    },
  ],
  invalid: [
    {
      name: "reports a @Given no scenario step matches, on its expression string",
      code: steps('  @Given("nobody writes this") never(): void {}'),
      options: SHOP_OPTIONS,
      errors: [
        {
          ...unreached("nobody writes this"),
          line: 5,
          column: 10,
          endLine: 5,
          endColumn: 30,
        },
      ],
    },
    {
      name: "reports a @When no scenario step matches",
      code: steps('  @When("nobody does this") never(): void {}'),
      options: SHOP_OPTIONS,
      errors: [unreached("nobody does this")],
    },
    {
      name: "reports a @Then no scenario step matches",
      code: steps('  @Then("nobody checks this") never(): void {}'),
      options: SHOP_OPTIONS,
      errors: [unreached("nobody checks this")],
    },
    {
      name: "reports each unreached step and none of the reached ones",
      code: steps(
        '  @Given("the shop is open") open(): void {}',
        '  @When("nobody does this") never(): void {}',
        '  @Then("the basket holds apples") holds(): void {}',
        '  @Then("nobody checks this") neverThen(): void {}',
      ),
      options: SHOP_OPTIONS,
      errors: [unreached("nobody does this"), unreached("nobody checks this")],
    },
    {
      name: "reports a step the outline text matches only before its Examples expand",
      code: steps('  @When("I pick <colour>") pick(): void {}'),
      options: SHOP_OPTIONS,
      errors: [unreached("I pick <colour>")],
    },
    {
      name: "reports a step whose built-in parameter type matches none of the scenario text",
      code: steps('  @When("I count {int} apples") count(count: number): void {}'),
      options: [{ features: features(COUNT) }],
      errors: [unreached("I count {int} apples")],
    },
    {
      name: "reports a step whose text outside an undeclared parameter type matches nothing",
      code: steps('  @When("nobody picks {shade}") pick(shade: string): void {}'),
      options: SHOP_OPTIONS,
      errors: [unreached("nobody picks {shade}")],
    },
    {
      name: "reports a step its file's literal @ParameterType regexp keeps from matching",
      code: steps(
        '  @When("I pick {metal}") pick(metal: string): void {}',
        '  @ParameterType("metal", /gold|silver/) static metal(raw: string): string { return raw; }',
      ),
      options: SHOP_OPTIONS,
      errors: [unreached("I pick {metal}")],
    },
    {
      name: "reports a step its file's literal @ParameterType regexp array keeps from matching",
      code: steps(
        '  @When("I pick {metal}") pick(metal: string): void {}',
        '  @ParameterType("metal", [/gold/, /silver/]) static metal(raw: string): string { return raw; }',
      ),
      options: SHOP_OPTIONS,
      errors: [unreached("I pick {metal}")],
    },
    {
      name: "reads a template literal without expressions as the expression",
      code: steps("  @Then(`nobody checks this`) never(): void {}"),
      options: SHOP_OPTIONS,
      errors: [unreached("nobody checks this")],
    },
    {
      name: "reads a step decorator imported under another name",
      code: [
        'import { Binding, Given as Arrange } from "@lindorm/gherkin";',
        "",
        "@Binding()",
        "export class ShopSteps {",
        '  @Arrange("nobody writes this") never(): void {}',
        "}",
      ].join("\n"),
      options: SHOP_OPTIONS,
      errors: [unreached("nobody writes this")],
    },
    {
      name: "reads a step decorator imported under a string name",
      code: [
        'import { Binding, "When" as Act } from "@lindorm/gherkin";',
        "",
        "@Binding()",
        "export class ShopSteps {",
        '  @Act("nobody does this") never(): void {}',
        "}",
      ].join("\n"),
      options: SHOP_OPTIONS,
      errors: [unreached("nobody does this")],
    },
    {
      name: "reads a step decorator reached through a namespace import",
      code: [
        'import * as gherkin from "@lindorm/gherkin";',
        "",
        "@gherkin.Binding()",
        "export class ShopSteps {",
        '  @gherkin.Then("nobody checks this") never(): void {}',
        "}",
      ].join("\n"),
      options: SHOP_OPTIONS,
      errors: [unreached("nobody checks this")],
    },
    {
      name: "honours a literal @ParameterType on a class @Binding registers through a namespace import",
      code: [
        'import * as gherkin from "@lindorm/gherkin";',
        "",
        "@gherkin.Binding()",
        "export class ShopSteps {",
        '  @gherkin.When("I pick {metal}") pick(metal: string): void {}',
        '  @gherkin.ParameterType("metal", /gold/) static metal(raw: string): string { return raw; }',
        "}",
      ].join("\n"),
      options: SHOP_OPTIONS,
      errors: [unreached("I pick {metal}")],
    },
    {
      name: "reads a step on a decorated class expression",
      code: [
        IMPORTS,
        "",
        "export const ShopSteps = @Binding() class {",
        '  @Given("nobody writes this") never(): void {}',
        "};",
      ].join("\n"),
      options: SHOP_OPTIONS,
      errors: [unreached("nobody writes this")],
    },
    {
      name: "reports a step whose only consumer is a feature file that does not parse",
      code: steps('  @Given("a step in a broken file") broken(): void {}'),
      options: [{ features: features(BROKEN) }],
      errors: [unreached("a step in a broken file")],
    },
    {
      name: "reports an unreached step beside a dangling feature symlink",
      code: steps('  @Given("nobody writes this") never(): void {}'),
      options: [{ features: features(DANGLING) }],
      errors: [unreached("nobody writes this")],
    },
    {
      name: "reads no feature file through a features glob that names a directory",
      code: steps('  @Given("the directory step") listed(): void {}'),
      options: [{ features: [`${DIRECTORY}/src/features`] }],
      errors: [unreached("the directory step")],
    },
    {
      name: "reports an unreached step beside a self-looping feature symlink",
      code: steps('  @Given("nobody writes this") never(): void {}'),
      options: [{ features: features(LOOPING) }],
      errors: [unreached("nobody writes this")],
    },
  ],
});

ruleTesterAt(PROJECT, {
  languageOptions: { parser: tseslint.parser },
}).run("no-unreached-step from a project's working directory", noUnreachedStep, {
  valid: [
    {
      name: "reports nothing under the default options for a step reached only from a feature file the plugin's `exclude` may take out of the suite",
      code: steps('  @Given("the wip step") wip(): void {}'),
    },
    {
      name: "reports nothing under the default options for a step reached only from a feature file inside a directory named node_modules",
      code: steps('  @Given("the node_modules directory step") dependency(): void {}'),
    },
    {
      name: "reports nothing under the default options for a step reached only from a feature file inside a directory named dist",
      code: steps('  @Given("the dist directory step") built(): void {}'),
    },
    {
      name: "reports nothing under the default options for a step reached only from a feature file inside a directory named coverage",
      code: steps('  @Given("the coverage directory step") covered(): void {}'),
    },
    {
      name: "reports nothing for a step reached only from a feature file a features glob lists outside the working directory",
      code: steps('  @Given("the outside step") outside(): void {}'),
      options: [{ features: ["src/**/*.feature", "../outside/*.feature"] }],
    },
  ],
  invalid: [
    {
      name: "reports under the default options a step reached only from a feature file outside the working directory",
      code: steps('  @Given("the outside step") outside(): void {}'),
      errors: [unreached("the outside step")],
    },
  ],
});

new RuleTester().run("no-unreached-step under the default parser", noUnreachedStep, {
  valid: [
    {
      name: "reads a file whose parser leaves the decorator fields off its nodes",
      code: [
        'import { Given } from "@lindorm/gherkin";',
        "",
        "export class Plain {",
        "  method() {}",
        "}",
      ].join("\n"),
      options: SHOP_OPTIONS,
    },
  ],
  invalid: [],
});
