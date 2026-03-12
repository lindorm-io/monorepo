import type { Constructor } from "@lindorm/types";
import { stageHook } from "#internal/entity/metadata/stage-metadata";
import type { SyncHookCallback } from "../types";

/**
 * Decorator that registers a synchronous hook to run when an entity is hydrated from DB results.
 *
 * Fires inside `defaultHydrateEntity` after all fields and FK columns are populated,
 * but before the entity is returned to the caller. Useful for computing derived fields
 * from DB values.
 *
 * **Must be synchronous** — async callbacks will throw at runtime.
 * For async post-load enrichment (e.g., fetching external data), use `@AfterLoad` instead.
 */
export const OnHydrate =
  <T extends Constructor, C = unknown>(callback: SyncHookCallback<T, C>) =>
  (_target: T, context: ClassDecoratorContext<T>): void => {
    stageHook(context.metadata, { decorator: "OnHydrate", callback: callback as any });
  };
