import type { EntityMetadata } from "../internal/entity/types/metadata.js";
import type { ProteusHookMeta } from "../types/proteus-hook-meta.js";

// ─── Event Payloads ───────────────────────────────────────────────────────

/**
 * Base event payload shared by all entity lifecycle events.
 */
export type EntityEventBase<E = any> = {
  /** The entity instance involved in the operation. */
  entity: E;
  /** Resolved metadata for the entity class. */
  metadata: EntityMetadata;
  /** Driver-specific connection handle. Consumers narrow with runtime detection. */
  connection: unknown;
  /** Request-scoped metadata (correlation id, actor, timestamp). */
  meta: ProteusHookMeta;
};

/**
 * Dispatched before and after an insert operation.
 */
export type InsertEvent<E = any> = EntityEventBase<E>;

/**
 * Dispatched before and after an update operation.
 * Includes the entity as it was when it was last loaded.
 */
export type UpdateEvent<E = any> = EntityEventBase<E> & {
  /**
   * The entity as it was when last hydrated, rebuilt from that snapshot — NOT
   * the caller's argument, which the caller already mutated. Always a fresh
   * copy, so mutating it cannot corrupt the entity being saved.
   *
   * `undefined` when the entity was never hydrated (constructed via `create()`),
   * because no prior state exists.
   *
   * ⚠ @Embedded parents are the exception: the snapshot holds the same
   * embeddable instance the entity does, so an in-place mutation of a nested
   * value is not recoverable here.
   */
  oldEntity: E | undefined;
};

/**
 * Dispatched before and after a hard destroy operation.
 */
export type DestroyEvent<E = any> = EntityEventBase<E>;

/**
 * Dispatched before and after a soft destroy operation.
 */
export type SoftDestroyEvent<E = any> = EntityEventBase<E>;

/**
 * Dispatched before and after a restore operation.
 */
export type RestoreEvent<E = any> = EntityEventBase<E>;

/**
 * Dispatched after an entity is loaded from the database.
 */
export type LoadEvent<E = any> = EntityEventBase<E>;
