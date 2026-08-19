/** Handed to `@AfterStep` as an argument, after the step it brackets. */
export type StepResult = {
  status: "passed" | "failed" | "skipped";
  error?: Error;
  durationMs: number;
};
