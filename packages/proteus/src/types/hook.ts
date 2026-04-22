import type { Constructor } from "@lindorm/types";
import type { ProteusHookMeta } from "./proteus-hook-meta.js";

/**
 * Synchronous hook callback for entity lifecycle events.
 *
 * Used by `@OnCreate`, `@OnValidate`, and `@OnHydrate`. These hooks run
 * synchronously during in-memory operations and must not return a Promise.
 */
export type SyncHookCallback<T extends Constructor> = (
  entity: InstanceType<T>,
  meta: ProteusHookMeta,
) => void;

/**
 * Hook callback for entity lifecycle events. May be async.
 *
 * Used by all Before/After lifecycle decorators (e.g. `@BeforeInsert`, `@AfterSave`).
 */
export type HookCallback<T extends Constructor> = (
  entity: InstanceType<T>,
  meta: ProteusHookMeta,
) => void | Promise<void>;
