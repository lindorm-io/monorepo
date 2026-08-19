import { beforeEach, describe, expect, test } from "vitest";
import { ScenarioInfo } from "../../classes/ScenarioInfo.js";
import { captureAsync, errorShape } from "../../__fixtures__/test-helpers.js";
import { AfterScenario } from "../../decorators/AfterScenario.js";
import { AfterStep } from "../../decorators/AfterStep.js";
import { BeforeScenario } from "../../decorators/BeforeScenario.js";
import { BeforeStep } from "../../decorators/BeforeStep.js";
import { Binding } from "../../decorators/Binding.js";
import { Context } from "../../decorators/Context.js";
import { Given } from "../../decorators/Given.js";
import { Inject } from "../../decorators/Inject.js";
import { Priority } from "../../decorators/Priority.js";
import { When } from "../../decorators/When.js";
import type { ScenarioResult } from "../../types/scenario-result.js";
import type { StepInfo } from "../../types/step-info.js";
import type { StepResult } from "../../types/step-result.js";
import type { ScenarioNode, StepModel } from "../model/types.js";
import { buildRegistry } from "../registry/build-registry.js";
import {
  drainContextRegistrations,
  drainRegistrations,
} from "../registry/registrations.js";
import { runScenario } from "./run-scenario.js";

const log: Array<string> = [];
const stepResults: Array<StepResult> = [];
const scenarioResults: Array<ScenarioResult> = [];
const seenInfo: Array<ScenarioInfo> = [];

@Context()
class TrackedContext {
  entries: Array<string> = [];

  dispose(): void {
    log.push("dispose:tracked");
  }
}

@Context()
class ThrowingDisposeContext {
  dispose(): void {
    throw new Error("dispose boom");
  }
}

@Context()
class ThrowingCtorContext {
  constructor() {
    throw new Error("context ctor boom");
  }
}

@Binding()
class AlphaHooks {
  @Inject(TrackedContext)
  private readonly tracked!: TrackedContext;

  @BeforeScenario("@ordered")
  @Priority(1)
  bsAlpha(): void {
    log.push("bs:alpha");
    this.tracked.entries.push("alpha");
  }

  @AfterScenario("@ordered")
  @Priority(1)
  asAlpha(result: ScenarioResult): void {
    log.push(`as:alpha:${result.status}`);
    scenarioResults.push(result);
  }

  @BeforeStep("@ordered")
  @Priority(1)
  bstAlpha(stepInfo: StepInfo): void {
    log.push(`bst:alpha:${stepInfo.text}`);
  }

  @AfterStep("@ordered")
  @Priority(1)
  astAlpha(stepInfo: StepInfo, result: StepResult): void {
    log.push(`ast:alpha:${result.status}`);
    stepResults.push(result);
  }
}

@Binding()
class BetaHooks {
  @BeforeScenario("@ordered")
  @Priority(2)
  bsBeta(): void {
    log.push("bs:beta");
  }

  @AfterScenario("@ordered")
  @Priority(2)
  asBeta(result: ScenarioResult): void {
    log.push(`as:beta:${result.status}`);
  }

  @BeforeStep("@ordered")
  @Priority(2)
  bstBeta(stepInfo: StepInfo): void {
    log.push(`bst:beta:${stepInfo.text}`);
  }

  @AfterStep("@ordered")
  @Priority(2)
  astBeta(stepInfo: StepInfo, result: StepResult): void {
    log.push(`ast:beta:${result.status}`);
  }
}

@Binding()
class ThrowingHooks {
  @BeforeScenario("@bs-throw")
  @Priority(0)
  bsThrow(): void {
    log.push("bs:throw");
    throw new Error("before-scenario boom");
  }

  @BeforeScenario("@bs-reject")
  async bsReject(): Promise<void> {
    await Promise.resolve();
    throw new Error("before-scenario rejected after a tick");
  }

  @BeforeStep("@bst-throw")
  bstThrow(): void {
    log.push("bst:throw");
    throw new Error("before-step boom");
  }

  @AfterStep("@ast-throw")
  astThrow(): void {
    log.push("ast:throw");
    throw new Error("after-step boom");
  }

  @AfterScenario("@as-throw")
  asThrow(): void {
    log.push("as:throw");
    throw new Error("after-scenario boom");
  }
}

@Binding()
class EagerThrowSteps {
  constructor() {
    throw new Error("eager ctor boom");
  }

  @BeforeScenario("@eager-ctor-throw")
  never(): void {
    log.push("bs:eager");
  }
}

@Binding()
class PartialSurvivor {
  @BeforeScenario("@partial")
  @Priority(1)
  bsSurvivor(): void {
    log.push("bs:survivor");
  }

  @AfterScenario("@partial")
  @Priority(1)
  asSurvivor(result: ScenarioResult): void {
    log.push(`as:survivor:${result.status}`);
    scenarioResults.push(result);
  }
}

@Binding()
class PartialCasualty {
  constructor() {
    throw new Error("partial ctor boom");
  }

  @BeforeScenario("@partial")
  @Priority(2)
  bsCasualty(): void {
    log.push("bs:casualty");
  }

  @AfterScenario("@partial")
  @Priority(2)
  asCasualty(): void {
    log.push("as:casualty");
  }
}

@Binding()
class BrokenContextHooks {
  @Inject(ThrowingCtorContext)
  private readonly broken!: ThrowingCtorContext;

  @BeforeScenario("@ctx-ctor")
  never(): void {
    log.push("bs:ctx-ctor");
  }
}

@Binding()
class InfoHooks {
  @Inject(ScenarioInfo)
  private readonly info!: ScenarioInfo;

  @BeforeScenario("@info")
  record(): void {
    seenInfo.push(this.info);
  }
}

@Binding()
class StepHost {
  @Given("step one")
  one(): void {
    log.push("step:one");
  }

  @Given("step two")
  two(): void {
    log.push("step:two");
  }

  @Given("a failing step")
  failing(): void {
    log.push("step:failing");
    throw new Error("step boom");
  }
}

@Binding()
class DisposalSteps {
  @Inject(ThrowingDisposeContext)
  private readonly leaky!: ThrowingDisposeContext;

  @Given("a step using the throwing dispose context")
  uses(): void {
    log.push("step:leaky");
  }

  @Given("a failing step using the throwing dispose context")
  failsWithLeak(): void {
    throw new Error("leaky step boom");
  }
}

@Binding()
class BrokenContextSteps {
  @Inject(ThrowingCtorContext)
  private readonly broken!: ThrowingCtorContext;

  @Given("a step needing the broken context")
  needs(): void {
    log.push("step:broken-context");
  }
}

@Binding()
class AmbiguousGiven {
  @Given("a duplicated lifecycle step")
  given(): void {}
}

@Binding()
class AmbiguousWhen {
  @When("a duplicated lifecycle step")
  when(): void {}
}

const registry = buildRegistry(
  [{ modulePath: "src/lifecycle.steps.ts", registrations: drainRegistrations() }],
  drainContextRegistrations(),
);

/**
 * Two modules whose PATH order anti-correlates with drain order, declaration
 * order and priority — pins the composed traversal (priority → module path →
 * declaration, After* reversed) END TO END through runScenario, not just at
 * the orderHooks unit level.
 */
const crossRegistry = (() => {
  @Binding()
  class ZebraCross {
    // Declared BEFORE the priority-5 hook: priority must beat declaration.
    @BeforeScenario("@xmod")
    zDefault(): void {
      log.push("xbs:z-default");
    }

    @BeforeScenario("@xmod")
    @Priority(5)
    zPriority(): void {
      log.push("xbs:z-priority5");
    }

    @AfterScenario("@xmod")
    zAfter(): void {
      log.push("xas:z-default");
    }
  }

  // Drained FIRST but registered under the LAST-sorting path — a traversal
  // keyed on drain order instead of module path flips the tiebreak below.
  const zebra = drainRegistrations();

  @Binding()
  class AlphaCross {
    @BeforeScenario("@xmod")
    aDefault(): void {
      log.push("xbs:a-default");
    }

    @AfterScenario("@xmod")
    aAfter(): void {
      log.push("xas:a-default");
    }

    @Given("a cross module step")
    step(): void {
      log.push("xstep");
    }
  }

  const alpha = drainRegistrations();

  return buildRegistry([
    { modulePath: "src/zz.steps.ts", registrations: zebra },
    { modulePath: "src/aa.steps.ts", registrations: alpha },
  ]);
})();

const uri = "src/features/lifecycle.feature";

const step = (text: string, overrides: Partial<StepModel> = {}): StepModel => ({
  column: 5,
  hasArgument: false,
  line: 10,
  text,
  type: "Context",
  ...overrides,
});

const scenario = (
  steps: Array<StepModel>,
  tags: Array<string> = [],
  overrides: Partial<ScenarioNode> = {},
): ScenarioNode => ({
  kind: "scenario",
  column: 3,
  line: 3,
  name: "lifecycle scenario",
  steps,
  tags,
  ...overrides,
});

const run = (node: ScenarioNode): Promise<void> =>
  runScenario({ featureName: "lifecycle feature", registry, scenario: node, uri });

describe("runScenario lifecycle", () => {
  beforeEach(() => {
    log.length = 0;
    stepResults.length = 0;
    scenarioResults.length = 0;
    seenInfo.length = 0;
  });

  describe("total order", () => {
    test("should bracket every step in the priority order with After* REVERSED, then dispose last", async () => {
      await run(scenario([step("step one"), step("step two")], ["@ordered"]));

      expect(log).toEqual([
        "bs:alpha",
        "bs:beta",
        "bst:alpha:step one",
        "bst:beta:step one",
        "step:one",
        "ast:beta:passed",
        "ast:alpha:passed",
        "bst:alpha:step two",
        "bst:beta:step two",
        "step:two",
        "ast:beta:passed",
        "ast:alpha:passed",
        "as:beta:passed",
        "as:alpha:passed",
        "dispose:tracked",
      ]);
    });

    test("should hand @AfterStep a passed result and @AfterScenario a passed result with the steps duration", async () => {
      await run(scenario([step("step one")], ["@ordered"]));

      expect(stepResults).toEqual([{ durationMs: expect.any(Number), status: "passed" }]);
      expect(scenarioResults).toEqual([
        { durationMs: expect.any(Number), status: "passed" },
      ]);
    });

    test("should run NO tagged hook when the scenario carries no matching tag", async () => {
      await run(scenario([step("step one")]));

      expect(log).toEqual(["step:one"]);
    });

    test("should traverse hooks across TWO modules by priority, then module path, After* reversed", async () => {
      await runScenario({
        featureName: "cross module feature",
        registry: crossRegistry,
        scenario: scenario([step("a cross module step")], ["@xmod"]),
        uri,
      });

      // priority 5 beats both the aa-path and zebra's own earlier declaration;
      // the default-priority tie breaks on module path (aa before zz) even
      // though zebra's module was DRAINED first; After* reverses that order.
      expect(log).toEqual([
        "xbs:z-priority5",
        "xbs:a-default",
        "xbs:z-default",
        "xstep",
        "xas:z-default",
        "xas:a-default",
      ]);
    });
  });

  describe("§4: @BeforeScenario throws", () => {
    test("should skip the remaining before-hooks and the steps, still run @AfterScenario and dispose", async () => {
      const error = await captureAsync(() =>
        run(scenario([step("step one")], ["@ordered", "@bs-throw"])),
      );

      // bs:throw is priority 0 — alpha and beta NEVER run, no step runs, yet
      // the after-scenario hooks and disposal do.
      expect(log).toEqual([
        "bs:throw",
        "as:beta:failed",
        "as:alpha:failed",
        "dispose:tracked",
      ]);
      expect(error.message).toMatchSnapshot();
    });

    test("should measure a ZERO steps duration when the steps phase never ran", async () => {
      await captureAsync(() =>
        run(scenario([step("step one")], ["@ordered", "@bs-throw"])),
      );

      expect(scenarioResults).toEqual([
        { durationMs: 0, error: expect.any(Error), status: "failed" },
      ]);
    });

    test("should treat a REJECTING async before-scenario hook exactly as a throwing one", async () => {
      const error = await captureAsync(() =>
        run(scenario([step("step one")], ["@bs-reject"])),
      );

      expect(error.message).toContain("@BeforeScenario hook failed");
      expect(error.message).toContain("before-scenario rejected after a tick");
      expect(log).toEqual([]);
    });
  });

  describe("§4: @BeforeStep throws", () => {
    test("should NOT run the step body, skip remaining steps, and STILL run @AfterStep with a failed zero-duration result", async () => {
      const error = await captureAsync(() =>
        run(scenario([step("step one"), step("step two")], ["@ordered", "@bst-throw"])),
      );

      // bstThrow has default priority — it runs AFTER alpha and beta, proving
      // the earlier before-step hooks completed. The body never runs; the
      // after-step hooks still do (cucumber-js parity — run-scenario.ts), and
      // step two is skipped without a single hook.
      expect(log).toEqual([
        "bs:alpha",
        "bs:beta",
        "bst:alpha:step one",
        "bst:beta:step one",
        "bst:throw",
        "ast:beta:failed",
        "ast:alpha:failed",
        "as:beta:failed",
        "as:alpha:failed",
        "dispose:tracked",
      ]);
      expect(stepResults).toEqual([
        { durationMs: 0, error: expect.any(Error), status: "failed" },
      ]);
      expect(stepResults[0].error?.message).toContain("before-step boom");
      expect(error.message).toMatchSnapshot();
    });
  });

  describe("§4: @AfterStep throws", () => {
    test("should fail the scenario even though the step PASSED, and skip the remaining steps", async () => {
      const error = await captureAsync(() =>
        run(scenario([step("step one"), step("step two")], ["@ordered", "@ast-throw"])),
      );

      // Reversal puts the default-priority throwing hook first; alpha and
      // beta STILL run after its throw — every after-step hook runs.
      expect(log).toEqual([
        "bs:alpha",
        "bs:beta",
        "bst:alpha:step one",
        "bst:beta:step one",
        "step:one",
        "ast:throw",
        "ast:beta:passed",
        "ast:alpha:passed",
        "as:beta:failed",
        "as:alpha:failed",
        "dispose:tracked",
      ]);
      expect(error.message).toMatchSnapshot();
    });
  });

  describe("§4: @AfterScenario throws", () => {
    test("should fail the scenario and still dispose", async () => {
      const error = await captureAsync(() =>
        run(scenario([step("step one")], ["@as-throw"])),
      );

      expect(log).toEqual(["step:one", "as:throw"]);
      expect(error.message).toMatchSnapshot();
    });
  });

  describe("§4: constructors throw", () => {
    test("should fail the scenario anchored to the CLASS when an eagerly constructed hook class throws", async () => {
      const error = await captureAsync(() =>
        run(scenario([step("step one")], ["@eager-ctor-throw"])),
      );

      expect(log).toEqual([]);
      expect(error.message).toMatchSnapshot();
    });

    test("should run the @AfterScenario of the classes ALREADY constructed and skip the casualty's", async () => {
      const error = await captureAsync(() =>
        run(scenario([step("step one")], ["@partial"])),
      );

      // Survivor (priority 1) constructed before the casualty threw: its
      // after-scenario hook runs with the failed result; the casualty's is
      // skipped — no instance exists to run it against.
      expect(log).toEqual(["as:survivor:failed"]);
      expect(error.message).toContain("Binding class PartialCasualty constructor threw");
    });

    test("should fail the scenario anchored to the TOKEN when a @Context constructor throws during eager construction", async () => {
      const error = await captureAsync(() =>
        run(scenario([step("step one")], ["@ctx-ctor"])),
      );

      expect(log).toEqual([]);
      expect(error.message).toContain(
        "Context class ThrowingCtorContext constructor threw",
      );
      expect(error.message).toContain("context ctor boom");
    });

    test("should fail the scenario anchored to the TOKEN when a @Context constructor throws on the lazy step path", async () => {
      const error = await captureAsync(() =>
        run(scenario([step("a step needing the broken context"), step("step one")])),
      );

      expect(log).toEqual([]);
      expect(error.message).toBe(
        "Context class ThrowingCtorContext constructor threw\n\ncontext ctor boom",
      );
    });
  });

  describe("§4: disposal", () => {
    test("should fail a scenario whose ONLY failure is disposal, as disposal_failed anchored to the context", async () => {
      const error = await captureAsync(() =>
        run(scenario([step("a step using the throwing dispose context")])),
      );

      expect(log).toEqual(["step:leaky"]);
      // The PRIMARY failure is the runner's own disposal_failed GherkinError —
      // teardown errors are never a consumer assertion, so they carry the urn.
      expect(error.code).toBe("disposal_failed");
      expect(error.type).toBe("urn:lindorm:gherkin:error:disposal_failed");
      expect((error.cause as Error).message).toBe("dispose boom");
      expect(errorShape(error as never)).toMatchSnapshot();
    });

    test("should append hook and disposal failures to the step failure — never replacing it", async () => {
      const error = await captureAsync(() =>
        run(
          scenario(
            [step("a failing step using the throwing dispose context")],
            ["@ast-throw"],
          ),
        ),
      );

      // Primary = the step failure; the after-step hook throw and the
      // disposal throw are APPENDED in lifecycle order — the disposal entry
      // renders its urn code above the anchored message.
      expect(error.message).toContain("urn:lindorm:gherkin:error:disposal_failed");
      expect(error.message).toMatchSnapshot();
    });
  });

  describe("§4 ⭐: step hooks fire only for DISPATCHED steps", () => {
    test("should run NO step hook for an UNDEFINED step", async () => {
      const error = await captureAsync(() =>
        run(scenario([step("no definition matches this")], ["@ordered"])),
      );

      expect((error as { code?: string }).code).toBe("undefined_step");
      expect(log).toEqual([
        "bs:alpha",
        "bs:beta",
        "as:beta:failed",
        "as:alpha:failed",
        "dispose:tracked",
      ]);
    });

    test("should run NO step hook for an AMBIGUOUS step", async () => {
      const error = await captureAsync(() =>
        run(scenario([step("a duplicated lifecycle step")], ["@ordered"])),
      );

      expect((error as { code?: string }).code).toBe("ambiguous_step");
      expect(log).toEqual([
        "bs:alpha",
        "bs:beta",
        "as:beta:failed",
        "as:alpha:failed",
        "dispose:tracked",
      ]);
    });

    test("should run NO step hook for an ARGUMENT-BEARING step", async () => {
      const error = await captureAsync(() =>
        run(scenario([step("step one", { hasArgument: true })], ["@ordered"])),
      );

      expect((error as { code?: string }).code).toBe("step_argument_unsupported");
      expect(log).toEqual([
        "bs:alpha",
        "bs:beta",
        "as:beta:failed",
        "as:alpha:failed",
        "dispose:tracked",
      ]);
    });

    test("should run NO step hook for steps SKIPPED by an earlier failure", async () => {
      await captureAsync(() =>
        run(scenario([step("a failing step"), step("step two")], ["@ordered"])),
      );

      // Exactly ONE bracketed step: the failing one. Step two contributes
      // nothing — no before-step, no body, no after-step.
      expect(log).toEqual([
        "bs:alpha",
        "bs:beta",
        "bst:alpha:a failing step",
        "bst:beta:a failing step",
        "step:failing",
        "ast:beta:failed",
        "ast:alpha:failed",
        "as:beta:failed",
        "as:alpha:failed",
        "dispose:tracked",
      ]);
      expect(stepResults).toEqual([
        { durationMs: expect.any(Number), error: expect.any(Error), status: "failed" },
      ]);
    });
  });

  describe("ScenarioInfo", () => {
    test("should pre-seed the full identity including rule name and examples row", async () => {
      await run(
        scenario([step("step one")], ["@info", "@smoke"], {
          examplesRow: [
            ["value", "a"],
            ["other", "b"],
          ],
          line: 12,
          name: "outline row a",
          ruleName: "grouped",
        }),
      );

      expect(seenInfo).toEqual([
        {
          examplesRow: { other: "b", value: "a" },
          featureName: "lifecycle feature",
          featureUri: uri,
          line: 12,
          ruleName: "grouped",
          scenarioName: "outline row a",
          tags: ["@info", "@smoke"],
        },
      ]);
    });

    test("should leave rule name and examples row undefined when absent", async () => {
      await run(scenario([step("step one")], ["@info"]));

      expect(seenInfo).toHaveLength(1);
      expect(seenInfo[0].ruleName).toBeUndefined();
      expect(seenInfo[0].examplesRow).toBeUndefined();
    });
  });
});
