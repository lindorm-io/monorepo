import type { EntityMetadata } from "../internal/entity/types/metadata";

// ─── Event Payloads ───────────────────────────────────────────────────────

/**
 * Base event payload shared by all entity lifecycle events.
 */
export type EntityEventBase<E = any, C = unknown> = {
  /** The entity instance involved in the operation. */
  entity: E;
  /** Resolved metadata for the entity class. */
  metadata: EntityMetadata;
  /** Driver-specific connection handle. Consumers narrow with runtime detection. */
  connection: unknown;
  /** The context from the ProteusSource (user session, trace info, etc.). */
  context: C;
};

/**
 * Dispatched before and after an insert operation.
 */
export type InsertEvent<E = any, C = unknown> = EntityEventBase<E, C>;

/**
 * Dispatched before and after an update operation.
 * Includes a snapshot of the entity before the update was applied.
 */
export type UpdateEvent<E = any, C = unknown> = EntityEventBase<E, C> & {
  /** Snapshot of the entity before the update. May be undefined if no snapshot was available. */
  oldEntity: E | undefined;
};

/**
 * Dispatched before and after a hard destroy operation.
 */
export type DestroyEvent<E = any, C = unknown> = EntityEventBase<E, C>;

/**
 * Dispatched before and after a soft destroy operation.
 */
export type SoftDestroyEvent<E = any, C = unknown> = EntityEventBase<E, C>;

/**
 * Dispatched before and after a restore operation.
 */
export type RestoreEvent<E = any, C = unknown> = EntityEventBase<E, C>;

/**
 * Dispatched after an entity is loaded from the database.
 */
export type LoadEvent<E = any, C = unknown> = EntityEventBase<E, C>;
