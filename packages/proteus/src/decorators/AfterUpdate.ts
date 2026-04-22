import type { Constructor } from "@lindorm/types";
import { stageHook } from "../internal/entity/metadata/stage-metadata.js";
import type { HookCallback } from "../types/index.js";

/**
 * Register a callback that fires after an entity is successfully updated in the database.
 *
 * May be async. The entity is already persisted when this callback runs.
 */
export const AfterUpdate =
  <T extends Constructor>(callback: HookCallback<T>) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageHook(context.metadata, { decorator: "AfterUpdate", callback: callback as any });
  };
