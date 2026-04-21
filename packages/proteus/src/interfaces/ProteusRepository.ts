import type { DeepPartial, Predicate } from "@lindorm/types";
import type {
  ClearOptions,
  CursorOptions,
  DeleteOptions,
  FindOptions,
  FindPaginatedOptions,
  FindPaginatedResult,
  PaginateOptions,
  PaginateResult,
  UpsertOptions,
} from "../types/index.js";
import type { IEntity } from "./Entity.js";
import type { IProteusCursor } from "./ProteusCursor.js";
import type { IProteusQueryBuilder } from "./ProteusQueryBuilder.js";

/**
 * Repository providing CRUD operations, queries, aggregates, and lifecycle management for an entity.
 *
 * Obtained via `source.repository(MyEntity)` or `transactionCtx.repository(MyEntity)`.
 * All write methods run the full ORM lifecycle: validation, hooks, cascades, and version checks.
 */
export interface IProteusRepository<E extends IEntity, O = DeepPartial<E>> {
  // Entity Handlers

  /** Create a new entity instance in memory, populating defaults and generated fields. */
  create(options?: O | E): E;
  /** Create a deep copy of an entity with a new primary key and reset metadata fields. */
  copy(entity: E): E;
  /** Validate an entity against its Zod schema and field constraints. Throws on failure. */
  validate(entity: E): void;

  // Queries

  /** Count entities matching the given criteria. */
  count(criteria?: Predicate<E>, options?: FindOptions<E>): Promise<number>;
  /** Check whether at least one entity matches the given criteria. */
  exists(criteria: Predicate<E>, options?: FindOptions<E>): Promise<boolean>;
  /** Find all entities matching the given criteria. */
  find(criteria?: Predicate<E>, options?: FindOptions<E>): Promise<Array<E>>;
  /** Find all entities matching the given criteria and return the total count alongside. */
  findAndCount(
    criteria?: Predicate<E>,
    options?: FindOptions<E>,
  ): Promise<[Array<E>, number]>;
  /** Find a single entity matching the criteria, or `null` if none exists. */
  findOne(criteria: Predicate<E>, options?: FindOptions<E>): Promise<E | null>;
  /** Find a single entity matching the criteria. Throws if none exists. */
  findOneOrFail(criteria: Predicate<E>, options?: FindOptions<E>): Promise<E>;
  /** Find a single entity matching the criteria, or insert the given entity if none exists. */
  findOneOrSave(
    criteria: Predicate<E>,
    entity: O | E,
    options?: FindOptions<E>,
  ): Promise<E>;

  // Upsert

  /** Insert the entity or update it if a conflict is detected on the specified keys. */
  upsert(entity: E, options?: UpsertOptions<E>): Promise<E>;
  upsert(entities: Array<E>, options?: UpsertOptions<E>): Promise<Array<E>>;

  // Create/Update/Destroy

  /** Insert a new entity. Runs validation, hooks, and cascades. Throws if the entity already exists. */
  insert(entity: O | E): Promise<E>;
  insert(entities: Array<O | E>): Promise<Array<E>>;

  /** Insert or update an entity based on whether it already exists. */
  save(entity: O | E): Promise<E>;
  save(entities: Array<O | E>): Promise<Array<E>>;

  /** Update an existing entity. Runs validation, hooks, version checks, and cascades. */
  update(entity: E): Promise<E>;
  update(entities: Array<E>): Promise<Array<E>>;

  /** Clone an entity: insert a deep copy with a new primary key. */
  clone(entity: E): Promise<E>;
  clone(entities: Array<E>): Promise<Array<E>>;

  /** Permanently delete an entity. Runs destroy hooks and cascade deletes on relations. */
  destroy(entity: E): Promise<void>;
  destroy(entities: Array<E>): Promise<void>;

  // Increments and Decrements

  /** Atomically increment a numeric field on all entities matching the criteria. */
  increment(criteria: Predicate<E>, property: keyof E, value: number): Promise<void>;
  /** Atomically decrement a numeric field on all entities matching the criteria. */
  decrement(criteria: Predicate<E>, property: keyof E, value: number): Promise<void>;

  // With Criteria

  /** Delete all entities matching the criteria (criteria-based, no entity instances needed). */
  delete(criteria: Predicate<E>, options?: DeleteOptions): Promise<void>;
  /** Update fields on all entities matching the criteria. */
  updateMany(criteria: Predicate<E>, update: DeepPartial<E>): Promise<void>;

  // With Soft Deletes

  /** Soft-delete an entity by setting its delete date. Runs soft-destroy hooks and cascades. */
  softDestroy(entity: E): Promise<void>;
  softDestroy(entities: Array<E>): Promise<void>;

  /**
   * Soft-delete all entities matching the criteria (criteria-based).
   *
   * Note: This is a criteria-based bulk operation. It does NOT load individual entities
   * and therefore does NOT fire per-entity lifecycle hooks (@BeforeSoftDestroy, etc.)
   * or subscriber events. Use softDestroy() for per-entity lifecycle support.
   */
  softDelete(criteria: Predicate<E>, options?: DeleteOptions): Promise<void>;
  /**
   * Restore soft-deleted entities matching the criteria by clearing their delete date.
   *
   * Note: This is a criteria-based bulk operation. It does NOT load individual entities
   * and therefore does NOT fire per-entity lifecycle hooks (@BeforeRestore, etc.)
   * or subscriber events. Use individual entity restore workflows for per-entity lifecycle support.
   */
  restore(criteria: Predicate<E>, options?: DeleteOptions): Promise<void>;

  // With Versioning

  /** Retrieve all historical versions of entities matching the criteria (temporal tables). */
  versions(criteria: Predicate<E>, options?: FindOptions<E>): Promise<Array<E>>;

  // Aggregates

  /** Compute the sum of a numeric field across matching entities. */
  sum(field: keyof E, criteria?: Predicate<E>): Promise<number | null>;
  /** Compute the average of a numeric field across matching entities. */
  average(field: keyof E, criteria?: Predicate<E>): Promise<number | null>;
  /** Find the minimum value of a field across matching entities. */
  minimum(field: keyof E, criteria?: Predicate<E>): Promise<number | null>;
  /** Find the maximum value of a field across matching entities. */
  maximum(field: keyof E, criteria?: Predicate<E>): Promise<number | null>;

  // With Expiry

  /** Return the remaining time-to-live in milliseconds for an entity with an expiry date. */
  ttl(criteria: Predicate<E>, options?: FindOptions<E>): Promise<number>;
  /** Delete all entities whose expiry date has passed. */
  deleteExpired(): Promise<void>;

  // Pagination

  /**
   * Keyset cursor pagination. Returns a page of entities with opaque cursors
   * for efficient, index-friendly seek-based traversal.
   *
   * Cursors are opaque but NOT integrity-protected. Multi-tenant deployments
   * must enforce scope independently via @ScopeField auto-filter.
   *
   * @param criteria  Optional filter predicate (composed with active system/user filters)
   * @param options   Pagination direction, page size, cursor, and sort order
   */
  paginate(
    criteria?: Predicate<E>,
    options?: PaginateOptions<E>,
  ): Promise<PaginateResult<E>>;

  /**
   * Offset/page-based pagination. Returns a page of entities with rich metadata
   * including total count, page info, and hasMore flag.
   *
   * Defaults to page 1 and pageSize 10 if not specified in options.
   *
   * @param criteria  Optional filter predicate
   * @param options   FindPaginatedOptions — use `page` and `pageSize` to control pagination
   */
  findPaginated(
    criteria?: Predicate<E>,
    options?: FindPaginatedOptions<E>,
  ): Promise<FindPaginatedResult<E>>;

  // Cursor

  /** Open a server-side cursor for streaming large result sets in batches. */
  cursor(options?: CursorOptions<E>): Promise<IProteusCursor<E>>;

  // Stream

  /** Return an async iterable that yields entities one-by-one from a server-side cursor. */
  stream(options?: CursorOptions<E>): AsyncIterable<E>;

  // Truncate

  /** Truncate the entity table, removing all rows. */
  clear(options?: ClearOptions): Promise<void>;

  // Global

  /** Create a query builder for this entity with full SQL expression support. */
  queryBuilder(): IProteusQueryBuilder<E>;
  /** Run schema synchronization and setup for this entity (create table, indexes, etc.). */
  setup(): Promise<void>;
}
