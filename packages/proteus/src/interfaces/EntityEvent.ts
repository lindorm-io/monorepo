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
 * Includes a snapshot of the entity before the update was applied.
 */
export type UpdateEvent<E = any> = EntityEventBase<E> & {
  /** Snapshot of the entity before the update. May be undefined if no snapshot was available. */
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
