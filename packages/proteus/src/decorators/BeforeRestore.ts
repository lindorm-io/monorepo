import type { Constructor } from "@lindorm/types";
import { stageHook } from "../internal/entity/metadata/stage-metadata";
import type { HookCallback } from "../types";

/**
 * Register a callback that fires before a soft-deleted entity is restored.
 *
 * Runs before the delete date is cleared. May be async.
 */
export const BeforeRestore =
  <T extends Constructor, C = unknown>(callback: HookCallback<T, C>) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageHook(context.metadata, {
      decorator: "BeforeRestore",
      callback: callback as any,
    });
  };
