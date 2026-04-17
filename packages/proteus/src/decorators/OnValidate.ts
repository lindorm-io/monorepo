import type { Constructor } from "@lindorm/types";
import { stageHook } from "../internal/entity/metadata/stage-metadata";
import type { SyncHookCallback } from "../types";

/**
 * Register a synchronous callback that fires during `repository.validate()`.
 *
 * Runs after the built-in Zod schema check. Throw to reject the entity.
 * **Must be synchronous.**
 */
export const OnValidate =
  <T extends Constructor, C = unknown>(callback: SyncHookCallback<T, C>) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageHook(context.metadata, { decorator: "OnValidate", callback: callback as any });
  };
