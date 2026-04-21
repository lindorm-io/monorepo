import type { Constructor } from "@lindorm/types";
import { stageHook } from "../internal/entity/metadata/stage-metadata.js";
import type { HookCallback } from "../types/index.js";

/**
 * Register a callback that fires after an entity is soft-destroyed.
 *
 * May be async. The entity's delete date has been set and persisted.
 */
export const AfterSoftDestroy =
  <T extends Constructor, C = unknown>(callback: HookCallback<T, C>) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageHook(context.metadata, {
      decorator: "AfterSoftDestroy",
      callback: callback as any,
    });
  };
