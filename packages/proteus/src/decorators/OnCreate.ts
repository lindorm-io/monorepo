import type { Constructor } from "@lindorm/types";
import { stageHook } from "../internal/entity/metadata/stage-metadata.js";
import type { SyncHookCallback } from "../types/index.js";

/**
 * Register a synchronous callback that fires when `repository.create()` builds a new entity instance.
 *
 * Useful for setting computed defaults or derived fields.
 * **Must be synchronous** — the create pipeline does not await.
 */
export const OnCreate =
  <T extends Constructor>(callback: SyncHookCallback<T>) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageHook(context.metadata, { decorator: "OnCreate", callback: callback as any });
  };
