/**
 * Per-invocation step identity, handed to `@BeforeStep`/`@AfterStep` as an
 * argument. `type`, not `keyword`: matching is text-only and the pickle
 * carries no keyword.
 */
export type StepInfo = {
  type: "Context" | "Action" | "Outcome" | "Unknown";
  text: string;
  line: number;
};
