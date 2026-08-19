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

Peer dependencies: `vite` >= 8 and `vitest` >= 4.1.4.

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

In the lindorm monorepo, `createVitestConfig({ decorators: true, gherkin: { features, steps } })` from the repo's `vitest.config.base.mjs` performs this wiring (test globs included), and `.feature` files follow the same cadence lanes as tests via the `*.integration.feature` / `*.weekly.feature` suffixes.

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
- There is deliberately **no skip tag** — exclusion is a config decision, not a per-scenario escape hatch.

The runner's OWN failures — undefined, ambiguous, pending, conversion, disposal, authoring errors — carry a `urn:lindorm:gherkin:error:<code>` type. A failing step or hook rethrows YOUR error with the anchor prepended, so assertion diffs survive intact. Gherkin syntax errors, empty scenarios and zero-row `Examples:` tables are authoring errors and fail red at the offending line.

The plugin also fails the whole run at startup (`feature_not_included`) if any `.feature` file on disk is not matched by the configured `features` patterns — a feature file nobody runs would otherwise be a silent pass at file granularity.

## Current scope

Shipped: everything above. Planned, not yet shipped: DataTable/DocString arguments, and tag-based scenario SELECTION (tag expressions on hooks are shipped; selecting which scenarios run is not). A step that carries a DataTable or DocString today fails red (`step_argument_unsupported`) rather than silently dropping the data, and an unknown plugin setting — `tags` included — throws at config time (`unknown_setting`) rather than being silently ignored.

## License

AGPL-3.0-or-later
