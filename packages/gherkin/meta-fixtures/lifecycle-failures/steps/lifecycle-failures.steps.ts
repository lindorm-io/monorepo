import type { ScenarioResult, StepInfo, StepResult } from "../../../src/index.js";
import {
  AfterScenario,
  AfterStep,
  BeforeScenario,
  BeforeStep,
  Binding,
  Context,
  Given,
  Inject,
  Priority,
} from "../../../src/index.js";

/**
 * The child's stdout is the meta-suite's oracle (as in
 * failure-modes.steps.ts): a sentinel proves a hook, step body or dispose()
 * RAN, its absence proves it never ran. Every hook carries a tag expression
 * so each feature file exercises exactly one failure mode — an untagged
 * scenario-level hook would run for every scenario in the fixture.
 */
const sentinel = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

@Context()
export class BeforeBoomContext {
  async dispose(): Promise<void> {
    sentinel("META_SENTINEL_BEFORE_BOOM_DISPOSED");
  }
}

@Binding()
export class BeforeScenarioBoom {
  @Inject(BeforeBoomContext)
  readonly probe!: BeforeBoomContext;

  @BeforeScenario("@before-boom")
  brokenSeed(): void {
    throw new Error("seed store offline");
  }

  @AfterScenario("@before-boom")
  teardown(result: ScenarioResult): void {
    sentinel(`META_SENTINEL_BEFORE_BOOM_AFTER_SCENARIO ${result.status}`);
  }

  @Given("a seeded first step")
  seededFirst(): void {
    sentinel("META_SENTINEL_BEFORE_BOOM_STEP_ONE");
  }

  @Given("a seeded second step")
  seededSecond(): void {
    sentinel("META_SENTINEL_BEFORE_BOOM_STEP_TWO");
  }
}

@Context()
export class BrokenCtorContext {
  constructor() {
    throw new Error("no backing store configured");
  }
}

@Binding()
export class ContextCtorBoom {
  @Inject(BrokenCtorContext)
  readonly broken!: BrokenCtorContext;

  @Given("a step needing a broken context")
  needsBroken(): void {
    sentinel("META_SENTINEL_CTOR_BOOM_BODY");
  }
}

@Binding()
export class BeforeStepBoom {
  @BeforeStep("@step-before-boom")
  brokenBefore(step: StepInfo): void {
    throw new Error(`lock unavailable for "${step.text}"`);
  }

  @AfterStep("@step-before-boom")
  observe(_step: StepInfo, result: StepResult): void {
    sentinel(`META_SENTINEL_STEP_BEFORE_BOOM_AFTER_STEP ${result.status}`);
  }

  @Given("a guarded step")
  guarded(): void {
    sentinel("META_SENTINEL_STEP_BEFORE_BOOM_BODY");
  }

  @Given("a trailing guarded step")
  trailingGuarded(): void {
    sentinel("META_SENTINEL_STEP_BEFORE_BOOM_TRAILING");
  }
}

@Binding()
export class AfterStepBoom {
  @AfterStep("@step-after-boom")
  brokenAfter(_step: StepInfo, result: StepResult): void {
    sentinel(`META_SENTINEL_STEP_AFTER_BOOM_OBSERVED ${result.status}`);
    throw new Error("report upload failed");
  }

  @Given("a recorded passing step")
  recorded(): void {
    sentinel("META_SENTINEL_STEP_AFTER_BOOM_BODY");
  }
}

@Context()
export class AfterBoomContext {
  async dispose(): Promise<void> {
    sentinel("META_SENTINEL_AFTER_BOOM_DISPOSED");
  }
}

@Binding()
export class AfterScenarioBoom {
  @Inject(AfterBoomContext)
  readonly probe!: AfterBoomContext;

  @AfterScenario("@after-boom")
  brokenTeardown(): void {
    throw new Error("teardown flake");
  }

  @Given("a passing after-boom step")
  passing(): void {
    sentinel("META_SENTINEL_AFTER_BOOM_STEP");
  }
}

@Context()
export class DisposeBetaContext {
  async dispose(): Promise<void> {
    sentinel("META_SENTINEL_DISPOSE_BETA");
  }
}

@Context()
export class DisposeAlphaContext {
  @Inject(DisposeBetaContext)
  readonly beta!: DisposeBetaContext;

  async dispose(): Promise<void> {
    sentinel("META_SENTINEL_DISPOSE_ALPHA");
    throw new Error("socket already closed");
  }
}

@Binding()
export class DisposeBoom {
  @Inject(DisposeAlphaContext)
  readonly alpha!: DisposeAlphaContext;

  @Given("a disposing step")
  disposing(): void {
    sentinel("META_SENTINEL_DISPOSE_STEP");
  }

  @Given("a disposing step that fails")
  disposingFails(): void {
    throw new Error("primary step failure");
  }
}

@Binding()
export class TagFilterProbe {
  @BeforeScenario("@no-such-tag")
  neverRuns(): void {
    sentinel("META_SENTINEL_TAG_FILTERED_HOOK");
  }

  @BeforeScenario("@tag-control")
  control(): void {
    sentinel("META_SENTINEL_TAG_CONTROL_HOOK");
  }

  @Given("a tag-controlled step")
  tagControlled(): void {
    sentinel("META_SENTINEL_TAG_CONTROL_STEP");
  }
}

// Module state, per feature file (isolate: true) — both order classes append
// here, and the LAST after-scenario hook prints the whole log.
const orderLog: Array<string> = [];

@Binding()
export class OrderAlpha {
  @BeforeScenario("@ordering")
  @Priority(10)
  beforeAlpha(): void {
    orderLog.push("before:alpha");
  }

  @BeforeStep("@ordering")
  @Priority(10)
  beforeStepAlpha(): void {
    orderLog.push("before-step:alpha");
  }

  @AfterStep("@ordering")
  @Priority(10)
  afterStepAlpha(): void {
    orderLog.push("after-step:alpha");
  }

  // Priority 10 runs FIRST among Before* and LAST among After* — so this hook
  // closes the scenario and prints the complete call log.
  @AfterScenario("@ordering")
  @Priority(10)
  afterAlpha(): void {
    orderLog.push("after:alpha");
    sentinel(`META_ORDER ${orderLog.join(">")}`);
  }

  @Given("an ordered step")
  ordered(): void {
    orderLog.push("step");
  }
}

@Binding()
export class OrderBeta {
  @BeforeScenario("@ordering")
  @Priority(20)
  beforeBeta(): void {
    orderLog.push("before:beta");
  }

  @BeforeStep("@ordering")
  @Priority(20)
  beforeStepBeta(): void {
    orderLog.push("before-step:beta");
  }

  @AfterStep("@ordering")
  @Priority(20)
  afterStepBeta(): void {
    orderLog.push("after-step:beta");
  }

  @AfterScenario("@ordering")
  @Priority(20)
  afterBeta(): void {
    orderLog.push("after:beta");
  }
}
