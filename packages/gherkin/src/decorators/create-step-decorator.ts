import { GherkinError } from "../errors/GherkinError.js";
import { stageStep } from "../internal/metadata/stage-metadata.js";
import type { StepDecoratorName } from "../internal/metadata/staged.js";
import type { GherkinMethodDecorator, StepFn } from "../types/step-fn.js";

// The decorator stages the expression STRING only — CucumberExpressions are
// built at registry-build time, once every step module has loaded, so a
// `{name}` declared in another module resolves regardless of import order
// (build-registry.ts).
export const createStepDecorator =
  (decorator: StepDecoratorName) =>
  (expression: string): GherkinMethodDecorator =>
  (_target: StepFn, context: ClassMethodDecoratorContext): void => {
    if (context.static === false) {
      stageStep(context.metadata, {
        decorator,
        expression,
        methodName: String(context.name),
      });
      return;
    }

    throw new GherkinError(`@${decorator} requires an instance method`, {
      code: "scope_violation",
      title: "Scope Violation",
      details:
        "Step methods run against a per-scenario instance; a static method has no scenario scope. Remove the static modifier.",
      data: { decorator, method: String(context.name) },
    });
  };
