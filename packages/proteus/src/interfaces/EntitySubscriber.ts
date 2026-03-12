import type { Constructor } from "@lindorm/types";
import type { EntityMetadata } from "../internal/entity/types/metadata";

// ─── Event Payloads ───────────────────────────────────────────────────────

/**
 * Base event payload shared by all subscriber lifecycle events.
 */
export type EntityEventBase<E = any> = {
  /** The entity instance involved in the operation. */
  entity: E;
  /** Resolved metadata for the entity class. */
  metadata: EntityMetadata;
  /** Driver-specific connection handle. Consumers narrow with runtime detection. */
  connection: unknown;
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

// ─── Subscriber Interface ─────────────────────────────────────────────────

/**
 * Cross-entity observer for lifecycle events.
 *
 * Register subscribers on a ProteusSource to receive notifications about
 * entity lifecycle events across all entity types. Subscribers fire AFTER
 * entity-level hooks (e.g. `@AfterInsert`).
 *
 * - `listenTo()` controls which entity classes this subscriber observes.
 *   Return an empty array, `undefined`, or omit the method to observe ALL entities.
 * - All event methods are optional. Implement only the events you care about.
 * - Event methods may be async. Errors propagate to the caller (and cause
 *   transaction rollback if inside a transaction).
 */
export interface IEntitySubscriber<E = any> {
  /** Return the entity classes this subscriber listens to. Empty/undefined = all entities. */
  listenTo?(): Array<Constructor>;

  beforeInsert?(event: InsertEvent<E>): void | Promise<void>;
  afterInsert?(event: InsertEvent<E>): void | Promise<void>;

  beforeUpdate?(event: UpdateEvent<E>): void | Promise<void>;
  afterUpdate?(event: UpdateEvent<E>): void | Promise<void>;

  beforeDestroy?(event: DestroyEvent<E>): void | Promise<void>;
  /**
   * Note: This event fires AFTER the transaction has committed. If this handler throws,
   * the delete will NOT be rolled back. Subscribers should be resilient to errors.
   */
  afterDestroy?(event: DestroyEvent<E>): void | Promise<void>;

  beforeSoftDestroy?(event: SoftDestroyEvent<E>): void | Promise<void>;
  /**
   * Note: This event fires AFTER the transaction has committed. If this handler throws,
   * the soft-delete will NOT be rolled back. Subscribers should be resilient to errors.
   */
  afterSoftDestroy?(event: SoftDestroyEvent<E>): void | Promise<void>;

  beforeRestore?(event: RestoreEvent<E>): void | Promise<void>;
  afterRestore?(event: RestoreEvent<E>): void | Promise<void>;

  afterLoad?(event: LoadEvent<E>): void | Promise<void>;
}
