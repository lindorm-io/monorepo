/**
 * Target type for gherkin method decorators. Returns `unknown` so both
 * `(): void` and `(): Promise<void>` step methods assign; the runner awaits
 * every returned value regardless of the annotation.
 */
export type StepFn = (...args: Array<any>) => unknown;

export type GherkinMethodDecorator = (
  target: StepFn,
  context: ClassMethodDecoratorContext,
) => void;
