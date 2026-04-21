import type { Constructor } from "@lindorm/types";
import { stageHook } from "../internal/entity/metadata/stage-metadata.js";
import type { HookCallback } from "../types/index.js";

/**
 * Register a callback that fires after an entity is permanently destroyed.
 *
 * May be async. The entity and cascade-deleted relations are already removed.
 */
export const AfterDestroy =
  <T extends Constructor, C = unknown>(callback: HookCallback<T, C>) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageHook(context.metadata, { decorator: "AfterDestroy", callback: callback as any });
  };
