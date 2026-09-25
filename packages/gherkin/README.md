# @lindorm/gherkin

Reqnroll-style BDD for vitest. A `.feature` file **is** a vitest test file: a Vite plugin compiles Gherkin to a test module at transform time, step definitions are TypeScript classes with stage-3 decorators, and every scenario lands in vitest's printed counts. Built for red-to-green TDD — an unimplemented step is a RED test with a pasteable snippet, never a skip, never a silent pass.

## Features

- `.feature` files as first-class vitest test files — Feature, Rule, Background, Example/Scenario, Scenario Outline + Examples (parsed by the official `@cucumber/gherkin`)
- `@Binding` step classes with `@Given` / `@When` / `@Then` — a fresh instance per scenario, sync or async step methods, always awaited
- Lifecycle hooks — `@BeforeFeature` / `@AfterFeature` (static) and `@BeforeScenario` / `@AfterScenario` / `@BeforeStep` / `@AfterStep` (instance), each with an optional tag expression and `@Priority` ordering
- Shared scenario state — `@Context` classes injected via `@Inject`, resolved recursively per scenario, with optional async `dispose()`; `ScenarioInfo` injectable anywhere
- `@ParameterType` as a decorator — typed (optionally async) transforms for custom `{expression}` parameters
- A strict failure contract: undefined, ambiguous, pending and conversion failures are all RED, anchored to the `.feature` file and line, with pasteable snippets
- Watch mode: editing a step module re-runs the features that use it
- ESM-only

## Installation

```bash
npm install --save-dev @lindorm/gherkin unplugin-swc
```

Peer dependencies: `vite` >= 8, `vitest` >= 4.1.4 and `zod` >= 4.3.6, plus `unplugin-swc` >= 1.5.9 as an optional peer. Step classes are written with stage-3 decorators, so the pipeline has to lower them; `unplugin-swc` is the route this package verifies, and any equivalent transform does. Without one, every feature file fails to import with `SyntaxError: Invalid or unexpected token`.

## Quick start

### 1. Wire the plugin

```ts
// vitest.config.ts
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";
import { gherkinPlugin } from "@lindorm/gherkin/plugin";

export default defineConfig({
  plugins: [
    // Before any TypeScript transform — .feature files are not TypeScript.
    gherkinPlugin({
      features: ["src/**/*.feature"], // default
      steps: ["src/**/*.steps.ts"], // default
      // tags: "not @slow", // optional transform-time selection — see Tags
    }),
    // Step classes use stage-3 decorators; the config must lower them.
    swc.vite({
      jsc: {
        parser: { syntax: "typescript", decorators: true },
        target: "es2022",
        transform: { decoratorVersion: "2022-03" },
        keepClassNames: true,
      },
    }),
  ],
  oxc: false,
  test: {
    include: ["src/**/*.feature"],
    // The default, pinned: an unhandled rejection must stay a loud failure.
    dangerouslyIgnoreUnhandledErrors: false,
  },
});
```

`test.include` REPLACES vitest's default test globs, so a package that also has plain `*.test.ts` files lists both patterns. Add to it by SPREADING: an overwrite that drops the feature globs fails the run at startup (`feature_not_collected`) instead of quietly emptying the counts.

### 2. Write a feature

```gherkin
# src/greeting.feature
@greeting
Feature: Greeting

  Background:
    Given the greeting "Hello"

  Example: greet a name
    When I greet "World"
    Then the result is "Hello, World!"

  Example: greet shouting
    When I greet "world" shouting
    Then the result is "Hello, WORLD!"

  Example: greet a table of guests
    When I greet everyone
      | name |
      | Anna |
      | Bo   |
    Then the card reads
      """
      Hello, Anna! Hello, Bo!
      """

  Scenario Outline: every greeting applies
    Given the greeting "<greeting>"
    When I greet "Lindorm"
    Then the result is "<greeting>, Lindorm!"

    Examples:
      | greeting |
      | Hi       |
      | Hej      |
```

### 3. Define the steps

```ts
// src/greeting.steps.ts
import {
  Binding,
  type DataTable,
  type DocString,
  Given,
  ParameterType,
  Then,
  When,
} from "@lindorm/gherkin";
import { expect } from "vitest";

type Volume = (value: string) => string;

@Binding()
export class GreetingSteps {
  private greeting!: string;
  private result!: string;

  @Given("the greeting {string}")
  theGreeting(greeting: string): void {
    this.greeting = greeting;
  }

  @When("I greet {string}")
  iGreet(name: string): void {
    this.result = `${this.greeting}, ${name}!`;
  }

  // {volume} is the custom parameter type below — the step receives the
  // TRANSFORMED value, not the matched text.
  @When("I greet {string} {volume}")
  iGreetWithVolume(name: string, volume: Volume): void {
    this.result = `${this.greeting}, ${volume(name)}!`;
  }

  // A DataTable or DocString arrives in the TRAILING argument slot.
  @When("I greet everyone")
  iGreetEveryone(table: DataTable): void {
    this.result = table
      .hashes()
      .map(({ name }) => `${this.greeting}, ${name}!`)
      .join(" ");
  }

  @Then("the card reads")
  theCardReads(card: DocString): void {
    expect(this.result).toBe(card.content);
  }

  @Then("the result is {string}")
  theResultIs(expected: string): void {
    expect(this.result).toBe(expected);
  }

  @ParameterType("volume", /shouting|whispering/)
  static volume(raw: string): Volume {
    return raw === "shouting"
      ? (value): string => value.toUpperCase()
      : (value): string => value.toLowerCase();
  }
}
```

The same example is runnable in [`example/`](https://github.com/lindorm-io/monorepo/tree/main/packages/gherkin/example).

Matching is text-only, following Cucumber: `Given`/`When`/`Then` are decorative, `And`/`But` inherit from the line above, and two definitions matching the same text are ambiguous — an error, never a resolution. Built-in parameter types (`{string}`, `{int}`, `{word}`, …) come from `@cucumber/cucumber-expressions`; `@ParameterType` declares custom ones on a static method. A `@ParameterType` regexp is required, and a custom type does not strip quotes — put them in the expression (`I greet "{name}"`) when the value is quoted.

## Hooks and shared state

```ts
// src/greeting-book.steps.ts
import {
  AbstractSteps,
  AfterScenario,
  AfterStep,
  BeforeFeature,
  Binding,
  Context,
  Inject,
  Priority,
  type ScenarioResult,
  type StepInfo,
  type StepResult,
  Then,
} from "@lindorm/gherkin";
import { expect } from "vitest";

// One instance per scenario, shared by every class that injects it.
@Context()
export class GreetingBook {
  entries: Array<string> = [];

  async dispose(): Promise<void> {
    /* optional teardown */
  }
}

// An @AbstractSteps base carries @Inject fields — never steps or hooks.
@AbstractSteps()
export abstract class GreetingBase {
  @Inject(GreetingBook) protected readonly book!: GreetingBook;
}

@Binding()
export class GreetingBookSteps extends GreetingBase {
  @BeforeFeature("@greeting") // STATIC — wider than a scenario
  @Priority(100) // lower runs first; After* run in REVERSE
  static async loadPhrases(): Promise<void> {
    /* … */
  }

  @AfterStep()
  record(step: StepInfo, result: StepResult): void {
    this.book.entries.push(`${step.text}: ${result.status}`);
  }

  @AfterScenario()
  dump(result: ScenarioResult): void {
    /* e.g. capture this.book.entries when result.status is "failed" */
  }

  @Then("the book has recorded {int} steps")
  theBookHasRecorded(count: number): void {
    expect(this.book.entries).toHaveLength(count);
  }
}
```

`And the book has recorded 3 steps`, appended to the first Example, asserts what the hook collected.

- **Lifetime rule:** scope wider than a scenario ⇒ static method. `@BeforeFeature`/`@AfterFeature` are static and run once per feature FILE (compiled to `beforeAll`/`afterAll`); the scenario- and step-level hooks are instance methods.
- **Tag expressions** gate every hook — scenario/step hooks against the scenario's tags, feature hooks against the union of the feature's tags. The syntax is Cucumber's (`@cucumber/tag-expressions`): `and` / `or` / `not` with parentheses over `@`-prefixed tags, e.g. `"@greeting and not @slow"`. No expression means always.
- **Order is total:** priority ascending → module path → declaration order; every `After*` kind runs in REVERSE of it — teardown unwinds setup.
- **Arguments carry per-invocation data:** `@BeforeStep(step: StepInfo)`, `@AfterStep(step: StepInfo, result: StepResult)`, `@AfterScenario(result: ScenarioResult)`. Scenario-scoped state is injected instead.
- **`@Context` classes** are constructed per scenario (per Examples row), resolved recursively (`@Context` may `@Inject` another; cycles are detected and named), and disposed in reverse construction order — disposal ALWAYS runs, even after failures, and continues past a throwing `dispose()`.
- **A class declaring an untagged scenario- or step-level hook is constructed for every scenario** — running an instance hook requires the instance. Tag expressions are the opt-out.
- Step hooks fire only for steps actually DISPATCHED to a definition — an undefined, ambiguous or skipped step runs no `@BeforeStep`/`@AfterStep`.
- After-hooks and disposal always run; when several things fail, the FIRST failure is reported and the rest are appended to it, never replacing it.

## DataTable and DocString

A step's DataTable or DocString arrives as the **trailing argument**, after any expression parameters. The slot is always passed — `undefined` when the step carries none — so the argument position never shifts. `DocString` carries `content` (the body, verbatim) and `mediaType` (the word after `"""` — e.g. `"json"`, or `undefined`).

`DataTable` carries cucumber-js's five methods, all values `string`: `raw()` (full matrix), `rows()` (body minus header), `hashes()` (header-keyed Records — a repeated header cell throws `invalid_data_table`, naming the key and its columns), `rowsHash()` (two-column key/value Record — any other width, or a repeated key, throws `invalid_data_table`), `transpose()` (a new DataTable). Outline `<placeholder>` values substitute into cells and DocString bodies exactly as into step text.

Typed conversion is zod: `createSet(schema)` parses every `hashes()` row — `table.createSet(z.object({ name: z.string() }))` in place of `hashes()` above — and `create(schema)` parses the table's **single** body row (any other count throws — never silent truncation; for vertical key/value tables use `schema.parse(table.rowsHash())`). Both are **synchronous** on purpose — they run inside your step body, where the runner cannot await them. A schema with an async refinement makes them throw zod's own "Encountered Promise during synchronous parse. Use `.parseAsync()` instead." — switch to `createAsync`/`createSetAsync` and `await`. A failed conversion is red (`table_conversion_failed`) with zod's issues and the step anchor.

An undefined step that carries an argument gets its snippet with the trailing parameter typed — `dataTable: DataTable` or `docString: DocString`.

## Tags

Gherkin tags thread into **vitest's native tags** with the `@` stripped: `@slow` registers as `tags: ["slow"]`, so `--tagsFilter` and `--listTags` work out of the box. Scenarios inherit tags from every level (feature → rule → scenario → examples).

Two filters exist, deliberately, with **different syntaxes** — this is a real wart of threading two ecosystems together, so keep them apart:

|                                  | syntax                                | when           | effect                                |
| -------------------------------- | ------------------------------------- | -------------- | ------------------------------------- |
| `tags` in `gherkinPlugin({ … })` | **Cucumber** — `@smoke and not @slow` | transform time | the scenario **never becomes a test** |
| `vitest --tagsFilter`            | **vitest** — `smoke && !slow`         | runtime        | the test **exists and is skipped**    |

Transform-time selection is the lane decision — in config, reviewable, absent from the counts. `--tagsFilter` is ad-hoc ("just the smoke tests now") and reports what it skipped. The `tags` setting has no CLI or env path on purpose: a runtime value would read a stale Vite transform cache — `--tagsFilter` is the runtime knob.

The plugin **declares every tag it finds at config time**: vitest's `strictTags` (default `true`, kept) fails collection on any undeclared tag, so the plugin scans every configured `.feature` file and injects the union into `test.tags`, merged with your own declarations. ⚠ The scan runs ONCE at config time — a tag newly added to a feature **mid-watch** fails collection until vitest restarts. That failure is loud (`strictTags` working), never a silent skip.

**Reserved tags error.** No tag carries runner meaning here (matching Cucumber), and a tag that means something in another runner is never silently inert:

| tag                                   | error                                                      |
| ------------------------------------- | ---------------------------------------------------------- |
| `@concurrent`, `@sequential`          | concurrency is not supported                               |
| `@skip`, `@ignore`, `@todo`, `@fails` | this runner has no skip tag — exclude via `tags` in config |

**Tag names must be legal vitest tag names.** Vitest rejects a name containing whitespace or `! * & | ( )`, or equal to `and` / `or` / `not` — so `@issue(1234)`, legal Gherkin and a common Cucumber convention, is refused (`invalid_tag_name`), anchored to its line in the feature file. Write `@issue-1234`.

There is deliberately **no skip tag**: a per-scenario skip is a hide-a-red-row escape hatch at the point of temptation; the config `tags` expression is a centralized, reviewable lane decision. For the same reason, authoring errors (a zero-row `Examples:`, a zero-step scenario) stay RED even when a `tags` expression excludes their tags — an excludable authoring error would be a skip tag by the back door. A fully excluded file reports as a skipped suite; a Rule or outline whose every scenario is excluded is omitted quietly.

## The failure contract

No scenario can silently pass. Undefined, ambiguous, pending and conversion failures are all RED in the printed counts, anchored to the `.feature` file and line:

```
FAIL  src/greeting.feature > Greeting > greet a table of guests
GherkinError: Undefined step

  When I greet everyone
  at src/greeting.feature:17:5

No step definition matched. Implement it:

  @When("I greet everyone")
  iGreetEveryone(dataTable: DataTable): void {
    throw new PendingStepError();
  }

The remaining 1 step in this scenario was skipped.
```

- **Undefined** — no definition matched: red, with a pasteable snippet.
- **Ambiguous** — more than one matched: red, naming every match and its location.
- **Pending** — a step throws `PendingStepError`: red until implemented.
- **Conversion failed** — the step matched but a parameter transform threw: reported honestly as a conversion failure, never downgraded to undefined.
- **Disposal failed** — a context's `dispose()` threw during teardown: the scenario is red (`disposal_failed`), disposal continues through the remaining contexts, and the failure is appended after any earlier one.
- Remaining steps in a failed scenario are **skipped**, so the cause is never buried.

The runner's OWN failures — undefined, ambiguous, pending, conversion, disposal, authoring errors — carry a `urn:lindorm:gherkin:error:<code>` type. A failing step or hook rethrows YOUR error with the anchor prepended, so assertion diffs survive intact. Gherkin syntax errors, empty scenarios and zero-row `Examples:` tables are authoring errors and fail red at the offending line.

The plugin also fails the whole run at startup if a `.feature` file on disk matches none of the configured `features` patterns (`feature_not_included`), or matches one but no `test.include` pattern (`feature_not_collected`) — a feature file nobody collects would otherwise be a silent pass at file granularity. The collection guard strips a `.integration.` / `.weekly.` suffix from the include globs before matching, so a suffixed glob satisfies it for the unsuffixed family too.

## Current scope

Feature-complete for the planned set: everything above — parsing and emission, step matching with custom parameter types, lifecycle hooks and contexts, DataTable/DocString + zod, tags, and the failure contract. An unknown plugin setting throws at config time (`unknown_setting`) rather than being silently ignored.

Deliberately out, for now: `RegExp` step expressions, living-doc HTML output, a `bin` that scaffolds step stubs, and richer built-in parameter types (`{email}`, `{date}`, `{list}`, …).

## License

AGPL-3.0-or-later
