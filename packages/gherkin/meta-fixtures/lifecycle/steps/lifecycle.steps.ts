import { AfterFeature, BeforeFeature, Binding, Given } from "../../../src/index.js";

/**
 * The child's stdout is the meta-suite's oracle (as in
 * failure-modes.steps.ts): a sentinel proves a hook or step body RAN, its
 * absence proves it never ran.
 */
const sentinel = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

@Binding()
export class LifecycleMetaSteps {
  @BeforeFeature("@boom")
  static brokenStart(): void {
    throw new Error("docker daemon is not running");
  }

  @AfterFeature("@boom")
  static cleanupAfterBoom(): void {
    sentinel("META_SENTINEL_AFTER_BOOM");
  }

  @BeforeFeature("@hooked")
  static start(): void {
    sentinel("META_SENTINEL_BEFORE_FEATURE");
  }

  @AfterFeature("@hooked")
  static stop(): void {
    sentinel("META_SENTINEL_AFTER_FEATURE");
  }

  @Given("a lifecycle step")
  step(): void {
    sentinel("META_SENTINEL_STEP_RAN");
  }
}
