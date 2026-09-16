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
npm install --save-dev @lindorm/gherkin
```

Peer dependencies: `vite` >= 8, `vitest` >= 4.1.4 and `zod` >= 4.3.6.

## Quick start

### 1. Wire the plugin

In the lindorm monorepo, that is the whole config:

```js
// vitest.config.mjs
import { createVitestConfig } from "../../vitest.config.base.mjs";

const config = await createVitestConfig({
  decorators: true,
  gherkin: {},
});

// Extend test.include by SPREADING — overwriting drops the feature globs.
config.test.include = [...config.test.include, "__tests__/**/*.test.ts"];

export default config;
```

`createVitestConfig` adds the plugin, the decorator transform and the feature globs, and `.feature`
files follow the same cadence lanes as tests via the `*.integration.feature` / `*.weekly.feature`
suffixes. `@lindorm/aes` is the worked example: `AesKit.feature` and `AesKit.steps.ts` beside the
class.

Outside the monorepo, the same wiring by hand:

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

Note that `test.include` REPLACES vitest's default test globs — a package that also has plain `*.test.ts` files must list both patterns.

Either way, never overwrite `test.include` once the plugin is wired: the run fails with `feature_not_collected` when a feature file matches no `test.include` pattern in its cadence FAMILY. A lane-suffixed glob (`*.integration.feature` / `*.weekly.feature`) counts for the whole family, so an overwrite that keeps a suffixed glob still passes the guard while the plain lane runs without its features.

### 2. Write a feature

```gherkin
Feature: Greeting

  Background:
    Given the greeting "Hello"

  Example: greet a name
    When I greet "World"
    Then the result is "Hello, World!"

  Example: greet shouting
    When I greet "world" shouting
    Then the result is "Hello, WORLD!"

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
import { Binding, Given, ParameterType, Then, When } from "@lindorm/gherkin";
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

The same example is runnable in [`example/`](./example).

Matching is text-only, following Cucumber: `Given`/`When`/`Then` are decorative, `And`/`But` inherit from the line above, and two definitions matching the same text are ambiguous — an error, never a resolution. Built-in parameter types (`{string}`, `{int}`, `{word}`, …) come from `@cucumber/cucumber-expressions`; `@ParameterType` declares custom ones on a static method. A `@ParameterType` regexp is required, and a custom type does not strip quotes — put them in the expression (`encryption "{encryption}"`) when the value is quoted.

## Hooks and shared state

```ts
import {
  AbstractSteps,
  AfterScenario,
  BeforeFeature,
  BeforeScenario,
  Binding,
  Context,
  Inject,
  Priority,
  ScenarioInfo,
  type ScenarioResult,
} from "@lindorm/gherkin";

@Context()
export class AesContext {
  kit!: AesKit;
  async dispose(): Promise<void> {
    /* optional teardown */
  }
}

@AbstractSteps()
export abstract class AesBase {
  @Inject(AesContext) protected readonly aes!: AesContext;
}

@Binding()
export class AesSteps extends AesBase {
  @Inject(ScenarioInfo) private readonly info!: ScenarioInfo;

  @BeforeFeature("@docker") // STATIC — wider than a scenario
  static async startDocker(): Promise<void> {
    /* … */
  }

  @BeforeScenario()
  @Priority(100) // lower runs first; After* run in REVERSE
  async seed(): Promise<void> {
    /* … */
  }

  @AfterScenario()
  dump(result: ScenarioResult): void {
    /* e.g. capture state on failure */
  }
}
```

- **Lifetime rule:** scope wider than a scenario ⇒ static method. `@BeforeFeature`/`@AfterFeature` are static and run once per feature FILE (compiled to `beforeAll`/`afterAll`); the scenario- and step-level hooks are instance methods.
- **Tag expressions** gate every hook — scenario/step hooks against the scenario's tags, feature hooks against the union of the feature's tags. The syntax is Cucumber's (`@cucumber/tag-expressions`): `and` / `or` / `not` with parentheses over `@`-prefixed tags, e.g. `"@docker and not @slow"`. No expression means always.
- **Order is total:** priority ascending → module path → declaration order; every `After*` kind runs in REVERSE of it — teardown unwinds setup.
- **Arguments carry per-invocation data:** `@BeforeStep(step: StepInfo)`, `@AfterStep(step: StepInfo, result: StepResult)`, `@AfterScenario(result: ScenarioResult)`. Scenario-scoped state is injected instead.
- **`@Context` classes** are constructed per scenario (per Examples row), resolved recursively (`@Context` may `@Inject` another; cycles are detected and named), and disposed in reverse construction order — disposal ALWAYS runs, even after failures, and continues past a throwing `dispose()`.
- **A class declaring an untagged scenario- or step-level hook is constructed for every scenario** — running an instance hook requires the instance. Tag expressions are the opt-out.
- Step hooks fire only for steps actually DISPATCHED to a definition — an undefined, ambiguous or skipped step runs no `@BeforeStep`/`@AfterStep`.
- After-hooks and disposal always run; when several things fail, the FIRST failure is reported and the rest are appended to it, never replacing it.

## DataTable and DocString

A step's DataTable or DocString arrives as the **trailing argument**, after any expression parameters. The slot is always passed — `undefined` when the step carries none — so the argument position never shifts.

```gherkin
When I import the catalog for "tenant-1"
  | name  | price |
  | apple | 3     |
  | pear  | 4     |
```

```ts
import { Binding, DataTable, DocString, When } from "@lindorm/gherkin";
import { z } from "zod";

const ProductSchema = z.object({ name: z.string(), price: z.coerce.number() });

@Binding()
export class CatalogSteps {
  @When("I import the catalog for {string}")
  iImportTheCatalog(tenant: string, table: DataTable): void {
    const products = table.createSet(ProductSchema); // Array<{ name: string; price: number }>
    /* … */
  }

  @When("I read the payload")
  iReadThePayload(doc: DocString): void {
    doc.content; // the body, verbatim
    doc.mediaType; // the word after """ — e.g. "json", or undefined
  }
}
```

`DataTable` carries cucumber-js's five methods, all values `string`: `raw()` (full matrix), `rows()` (body minus header), `hashes()` (header-keyed Records), `rowsHash()` (two-column key/value Record — any other width throws `invalid_data_table`), `transpose()` (a new DataTable). Outline `<placeholder>` values substitute into cells and DocString bodies exactly as into step text.

Typed conversion is zod: `createSet(schema)` parses every `hashes()` row; `create(schema)` parses the table's **single** body row (any other count throws — never silent truncation; for vertical key/value tables use `schema.parse(table.rowsHash())`). Both are **synchronous** on purpose — they run inside your step body, where the runner cannot await them. A schema with an async refinement makes them throw zod's own "Encountered Promise during synchronous parse. Use `.parseAsync()` instead." — switch to `createAsync`/`createSetAsync` and `await`. A failed conversion is red (`table_conversion_failed`) with zod's issues and the step anchor.

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
FAIL  features/aes-round-trip.feature > AES round trip > content survives a round trip > every content encryption round-trips
GherkinError: Undefined step

  Given an oct key with algorithm "A128KW" and encryption "A256CBC-HS512"
  at features/aes-round-trip.feature:11:7

No step definition matched. Implement it:

  @Given("an oct key with algorithm {string} and encryption {string}")
  anOctKeyWithAlgorithmAndEncryption(string: string, string2: string): void {
    throw new PendingStepError();
  }

The remaining 2 steps in this scenario were skipped.
```

- **Undefined** — no definition matched: red, with a pasteable snippet.
- **Ambiguous** — more than one matched: red, naming every match and its location.
- **Pending** — a step throws `PendingStepError`: red until implemented.
- **Conversion failed** — the step matched but a parameter transform threw: reported honestly as a conversion failure, never downgraded to undefined.
- **Disposal failed** — a context's `dispose()` threw during teardown: the scenario is red (`disposal_failed`), disposal continues through the remaining contexts, and the failure is appended after any earlier one.
- Remaining steps in a failed scenario are **skipped**, so the cause is never buried.
- There is deliberately **no skip tag** — exclusion is a config decision, not a per-scenario escape hatch (see Tags).

The runner's OWN failures — undefined, ambiguous, pending, conversion, disposal, authoring errors — carry a `urn:lindorm:gherkin:error:<code>` type. A failing step or hook rethrows YOUR error with the anchor prepended, so assertion diffs survive intact. Gherkin syntax errors, empty scenarios and zero-row `Examples:` tables are authoring errors and fail red at the offending line.

The plugin also fails the whole run at startup if any `.feature` file on disk is not matched by the configured `features` patterns (`feature_not_included`), or matches them but no `test.include` pattern in its cadence family (`feature_not_collected`) — a feature file nobody collects would otherwise be a silent pass at file granularity. The collection guard checks the FAMILY, not the mode: a lane-suffixed include glob proves the family collectable, so it cannot catch an overwrite that keeps only a suffixed glob.

## Current scope

Feature-complete for the planned set: everything above — parsing and emission, step matching with custom parameter types, lifecycle hooks and contexts, DataTable/DocString + zod, tags, and the failure contract. An unknown plugin setting throws at config time (`unknown_setting`) rather than being silently ignored.

Deliberately out, for now: `RegExp` step expressions, living-doc HTML output, a `bin` that scaffolds step stubs, and richer built-in parameter types (`{email}`, `{date}`, `{list}`, …).

## License

AGPL-3.0-or-later
