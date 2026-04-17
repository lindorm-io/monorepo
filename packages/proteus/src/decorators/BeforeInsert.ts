import type { Constructor } from "@lindorm/types";
import { stageHook } from "../internal/entity/metadata/stage-metadata";
import type { HookCallback } from "../types";

/**
 * Register a callback that fires before an entity is inserted into the database.
 *
 * Runs after validation but before the INSERT statement is executed.
 * May be async.
 */
export const BeforeInsert =
  <T extends Constructor, C = unknown>(callback: HookCallback<T, C>) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageHook(context.metadata, { decorator: "BeforeInsert", callback: callback as any });
  };
