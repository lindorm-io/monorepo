import type { Constructor } from "@lindorm/types";
import { stageHook } from "../internal/entity/metadata/stage-metadata.js";
import type { HookCallback } from "../types/index.js";

/**
 * Register a callback that fires before an entity is soft-destroyed.
 *
 * Runs before the delete date is set and before cascade soft-deletes.
 * May be async.
 */
export const BeforeSoftDestroy =
  <T extends Constructor, C = unknown>(callback: HookCallback<T, C>) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageHook(context.metadata, {
      decorator: "BeforeSoftDestroy",
      callback: callback as any,
    });
  };
