import type { Constructor } from "@lindorm/types";
import { stageHook } from "#internal/entity/metadata/stage-metadata";
import type { HookCallback } from "../types";

/**
 * Register a callback that fires before an entity is permanently destroyed.
 *
 * Runs before cascade deletes on relations and before the DELETE statement.
 * May be async.
 */
export const BeforeDestroy =
  <T extends Constructor, C = unknown>(callback: HookCallback<T, C>) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageHook(context.metadata, {
      decorator: "BeforeDestroy",
      callback: callback as any,
    });
  };
