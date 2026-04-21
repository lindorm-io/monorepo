import type { Constructor } from "@lindorm/types";
import { stageHook } from "../internal/entity/metadata/stage-metadata.js";
import type { HookCallback } from "../types/index.js";

/**
 * Register a callback that fires before an entity is saved (insert or update).
 *
 * Fires for both `repository.save()` and `repository.insert()`/`repository.update()`.
 * May be async.
 */
export const BeforeSave =
  <T extends Constructor, C = unknown>(callback: HookCallback<T, C>) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageHook(context.metadata, { decorator: "BeforeSave", callback: callback as any });
  };
