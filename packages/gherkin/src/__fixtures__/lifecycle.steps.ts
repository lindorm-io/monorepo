import { expect } from "vitest";
import type { ScenarioResult, StepInfo, StepResult } from "../index.js";
import {
  AbstractSteps,
  AfterScenario,
  AfterStep,
  BeforeFeature,
  BeforeScenario,
  BeforeStep,
  Binding,
  Context,
  Given,
  Inject,
  Priority,
  ScenarioInfo,
  Then,
  When,
} from "../index.js";

/**
 * The M2 analogue of round-trip.feature: the full lifecycle running GREEN
 * through the package's own vitest run (lifecycle.feature) — a shared
 * `@Context` across two `@Binding` classes via an `@AbstractSteps` base,
 * every hook kind with `@Priority` ordering and `@AfterStep`/`@AfterScenario`
 * REVERSED, a tagged-out hook that must never fire, and dispose() observed.
 * The final scenario asserts the PREVIOUS scenario's completed log — module
 * state survives across scenarios within the feature file's worker, and
 * vitest runs a file's tests in registration order.
 */
const log: Array<string> = [];

@Context()
export class LifecycleContext {
  @Inject(ScenarioInfo)
  readonly info!: ScenarioInfo;

  touched: Array<string> = [];

  dispose(): void {
    log.push(`${this.info.scenarioName}:dispose`);
  }
}

@AbstractSteps()
export abstract class LifecycleBase {
  @Inject(LifecycleContext)
  protected readonly shared!: LifecycleContext;
}

@Binding()
export class LifecycleAlphaSteps extends LifecycleBase {
  @BeforeFeature("@lifecycle")
  static featureStarted(): void {
    log.push("feature:before");
  }

  @BeforeFeature("@no-such-tag")
  static featureNever(): void {
    log.push("feature:never");
  }

  @BeforeScenario("@lifecycle")
  @Priority(1)
  begin(): void {
    log.push(`${this.shared.info.scenarioName}:before-scenario:alpha`);
  }

  @AfterScenario("@lifecycle")
  @Priority(1)
  end(result: ScenarioResult): void {
    log.push(`${this.shared.info.scenarioName}:after-scenario:alpha:${result.status}`);
  }

  @BeforeStep("@lifecycle")
  @Priority(1)
  beforeEach(step: StepInfo): void {
    log.push(`${this.shared.info.scenarioName}:before-step:alpha:${step.text}`);
  }

  @AfterStep("@lifecycle")
  @Priority(1)
  afterEach(step: StepInfo, result: StepResult): void {
    log.push(`${this.shared.info.scenarioName}:after-step:alpha:${result.status}`);
  }

  @Given("alpha touches the shared context")
  touch(): void {
    this.shared.touched.push("alpha");
  }
}

@Binding()
export class LifecycleBetaSteps extends LifecycleBase {
  @BeforeScenario("@lifecycle")
  @Priority(2)
  begin(): void {
    log.push(`${this.shared.info.scenarioName}:before-scenario:beta`);
  }

  @BeforeScenario("@no-such-tag")
  taggedOut(): void {
    log.push("TAGGED_OUT_HOOK_RAN");
  }

  @AfterScenario("@lifecycle")
  @Priority(2)
  end(result: ScenarioResult): void {
    log.push(`${this.shared.info.scenarioName}:after-scenario:beta:${result.status}`);
  }

  @BeforeStep("@lifecycle")
  @Priority(2)
  beforeEach(step: StepInfo): void {
    log.push(`${this.shared.info.scenarioName}:before-step:beta:${step.text}`);
  }

  @AfterStep("@lifecycle")
  @Priority(2)
  afterEach(step: StepInfo, result: StepResult): void {
    log.push(`${this.shared.info.scenarioName}:after-step:beta:${result.status}`);
  }

  @When("beta touches the shared context")
  touch(): void {
    this.shared.touched.push("beta");
  }

  @Then("the shared context recorded both touches")
  assertTouches(): void {
    // Both binding classes wrote into ONE LifecycleContext instance — the
    // shared @Inject through the @AbstractSteps base.
    expect(this.shared.touched).toEqual(["alpha", "beta"]);
  }

  @Then("the recorded lifecycle for {string} is complete")
  assertLifecycle(name: string): void {
    expect(log.filter((entry) => entry.startsWith(`${name}:`))).toEqual([
      `${name}:before-scenario:alpha`,
      `${name}:before-scenario:beta`,
      `${name}:before-step:alpha:alpha touches the shared context`,
      `${name}:before-step:beta:alpha touches the shared context`,
      `${name}:after-step:beta:passed`,
      `${name}:after-step:alpha:passed`,
      `${name}:before-step:alpha:beta touches the shared context`,
      `${name}:before-step:beta:beta touches the shared context`,
      `${name}:after-step:beta:passed`,
      `${name}:after-step:alpha:passed`,
      `${name}:before-step:alpha:the shared context recorded both touches`,
      `${name}:before-step:beta:the shared context recorded both touches`,
      `${name}:after-step:beta:passed`,
      `${name}:after-step:alpha:passed`,
      `${name}:after-scenario:beta:passed`,
      `${name}:after-scenario:alpha:passed`,
      `${name}:dispose`,
    ]);

    // @BeforeFeature ran ONCE, first, and only for its matching tag.
    expect(log[0]).toBe("feature:before");
    expect(log.filter((entry) => entry === "feature:before")).toHaveLength(1);
    expect(log).not.toContain("feature:never");
    expect(log).not.toContain("TAGGED_OUT_HOOK_RAN");
  }
}
