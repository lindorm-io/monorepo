/**
 * Handed to `@AfterScenario` as an argument — per-invocation data, never an
 * injected token: an injected scenario-scoped object that changes
 * mid-scenario is what the injection/argument split forbids.
 */
export type ScenarioResult = {
  status: "passed" | "failed";
  error?: Error;
  durationMs: number;
};
