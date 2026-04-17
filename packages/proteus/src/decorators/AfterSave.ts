import { stageHook } from "../internal/entity/metadata/stage-metadata";
import type { Constructor } from "@lindorm/types";
import type { HookCallback } from "../types";

/**
 * Register a callback that fires after an entity is successfully saved (insert or update).
 *
 * May be async. The entity is already persisted when this callback runs.
 */
export const AfterSave =
  <T extends Constructor, C = unknown>(callback: HookCallback<T, C>) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageHook(context.metadata, { decorator: "AfterSave", callback: callback as any });
  };
