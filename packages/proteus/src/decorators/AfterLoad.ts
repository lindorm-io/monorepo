import type { Constructor } from "@lindorm/types";
import { stageHook } from "../internal/entity/metadata/stage-metadata.js";
import type { HookCallback } from "../types/index.js";

/**
 * Register a callback that fires after an entity is loaded from the database.
 *
 * Runs after hydration and relation loading. May be async.
 * Use this for post-load enrichment such as fetching external data.
 */
export const AfterLoad =
  <T extends Constructor, C = unknown>(callback: HookCallback<T, C>) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageHook(context.metadata, { decorator: "AfterLoad", callback: callback as any });
  };
