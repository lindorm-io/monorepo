import { isUndefined } from "@lindorm/is";
import { GherkinError } from "../errors/GherkinError.js";
import { readOwnHooks, stageHook } from "../internal/metadata/stage-metadata.js";
import type { HookKind } from "../internal/metadata/staged.js";
import type { GherkinMethodDecorator, StepFn } from "../types/step-fn.js";

// The decorator stages the tag expression STRING only — parsing arrives with
// hook execution, so validation happens where the expression is evaluated.
export const createHookDecorator =
  (kind: HookKind, staticScope: boolean) =>
  (tagExpression?: string): GherkinMethodDecorator =>
  (_target: StepFn, context: ClassMethodDecoratorContext): void => {
    if (context.static === staticScope) {
      const methodName = String(context.name);
      const staged = readOwnHooks(context.metadata);

      // Same kind twice on one method — regardless of tag expression — would
      // run the method twice per match. Cross-kind stacking stays legal.
      if (
        staged.some(
          (hook) =>
            hook.kind === kind &&
            hook.methodName === methodName &&
            hook.static === context.static,
        )
      ) {
        throw new GherkinError(`@${kind} is applied twice to method ${methodName}`, {
          code: "duplicate_hook",
          details:
            "Both decorators stage, so the method would silently run twice per match. Tag expressions support `or`, so stacking two of them buys nothing except double execution — combine them into one decorator.",
          data: { hook: kind, method: methodName },
        });
      }

      stageHook(context.metadata, {
        kind,
        methodName,
        static: context.static,
        ...(isUndefined(tagExpression) ? {} : { tagExpression }),
      });
      return;
    }

    if (staticScope) {
      throw new GherkinError(`@${kind} requires a static method`, {
        code: "scope_violation",
        details:
          "The hook's scope is wider than a scenario, so it cannot run against a per-scenario instance. Add the static modifier.",
        data: { hook: kind, method: String(context.name) },
      });
    }

    throw new GherkinError(`@${kind} requires an instance method`, {
      code: "scope_violation",
      details:
        "The hook runs against a per-scenario instance; a static method has no scenario scope. Remove the static modifier.",
      data: { hook: kind, method: String(context.name) },
    });
  };
