import type { Constructor } from "@lindorm/types";
import { stageHook } from "#internal/entity/metadata/stage-metadata";
import type { HookCallback } from "../types";

/**
 * Register a callback that fires before an entity is updated in the database.
 *
 * Runs after validation and version check but before the UPDATE statement.
 * May be async.
 */
export const BeforeUpdate =
  <T extends Constructor, C = unknown>(callback: HookCallback<T, C>) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageHook(context.metadata, { decorator: "BeforeUpdate", callback: callback as any });
  };
