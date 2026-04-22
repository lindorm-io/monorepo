import { stageHook } from "../internal/entity/metadata/stage-metadata.js";
import type { Constructor } from "@lindorm/types";
import type { HookCallback } from "../types/index.js";

/**
 * Register a callback that fires after an entity is successfully saved (insert or update).
 *
 * May be async. The entity is already persisted when this callback runs.
 */
export const AfterSave =
  <T extends Constructor>(callback: HookCallback<T>) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageHook(context.metadata, { decorator: "AfterSave", callback: callback as any });
  };
