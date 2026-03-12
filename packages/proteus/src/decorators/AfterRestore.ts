import type { Constructor } from "@lindorm/types";
import { stageHook } from "#internal/entity/metadata/stage-metadata";
import type { HookCallback } from "../types";

/**
 * Register a callback that fires after a soft-deleted entity is restored.
 *
 * May be async. The entity's delete date has been cleared and persisted.
 */
export const AfterRestore =
  <T extends Constructor, C = unknown>(callback: HookCallback<T, C>) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageHook(context.metadata, { decorator: "AfterRestore", callback: callback as any });
  };
