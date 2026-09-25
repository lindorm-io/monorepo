import { isFinite } from "@lindorm/is";
import { GherkinError } from "../errors/GherkinError.js";
import {
  readOwnPriorities,
  stagePriority,
  toModifierKey,
} from "../internal/metadata/stage-metadata.js";
import type { GherkinMethodDecorator, StepFn } from "../types/step-fn.js";

/**
 * Order a hook against other hooks of the same kind. Default 10 000. Lower
 * runs FIRST on `@Before*` hooks and LAST on `@After*` hooks — After hooks
 * run in reverse so teardown unwinds setup. Legal on hooks ONLY; a
 * `@Priority` on any other method throws at `@Binding`/`@Context` time
 * (steps run in pickle order, so a step priority would be silently inert).
 */
export const Priority =
  (priority: number): GherkinMethodDecorator =>
  (_target: StepFn, context: ClassMethodDecoratorContext): void => {
    // Ordering is a numeric sort; NaN and the infinities make comparator
    // results NaN or degenerate, corrupting the order SILENTLY.
    if (isFinite(priority) === false) {
      // String(priority): the guard narrows this branch to never, and
      // restrict-template-expressions refuses a never-typed interpolation.
      throw new GherkinError(
        `@Priority requires a finite number, got ${String(priority)}`,
        {
          code: "invalid_priority",
          details:
            "Hooks order by numeric comparison — NaN or an infinite priority corrupts the sort silently instead of failing. Pass a finite number.",
          data: { method: String(context.name), priority, static: context.static },
        },
      );
    }

    const key = toModifierKey(context.static, String(context.name));
    const staged = readOwnPriorities(context.metadata);

    if (staged.every((entry) => entry.key !== key)) {
      stagePriority(context.metadata, {
        key,
        methodName: String(context.name),
        priority,
        static: context.static,
      });
      return;
    }

    throw new GherkinError(
      `@Priority is applied twice to method ${String(context.name)}`,
      {
        code: "duplicate_priority",
        details:
          "A hook holds one priority; with two staged, composition would silently pick one. Remove the extra decorator.",
        data: { method: String(context.name), static: context.static },
      },
    );
  };
