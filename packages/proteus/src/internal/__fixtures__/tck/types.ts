import type { Constructor } from "@lindorm/types";
import type { IEntity, IProteusRepository } from "../../../interfaces/index.js";
import type { MetaDriver } from "../../entity/types/metadata.js";
import type { NamingStrategy } from "../../../types/source-options.js";

export type TckCapabilities = {
  // ─── Always-on (tested unconditionally) ──────────────────────────────────────
  // scope, stream, relations, upsert

  // ─── Gated capabilities ──────────────────────────────────────────────────────

  /** @DeleteDateField + softDestroy() / restore() / withDeleted queries */
  softDelete: boolean;
  /** @ExpiryDateField + ttl() / deleteExpired() */
  expiry: boolean;
  /** Temporal versioning: @VersionKeyField composite PK, versions() history */
  versioning: boolean;
  /** Server-side cursor pagination: cursor() / nextBatch() */
  cursor: boolean;
  /** Lazy relation loading (loading: "lazy") */
  lazyLoading: boolean;
  /** @EmbeddedList collection tables */
  embeddedLists: boolean;
  /** Atomic increment() / decrement() without full entity load */
  atomicIncrements: boolean;
  /** source.queryBuilder() — where, orderBy, skip, take, select, aggregates, clone */
  queryBuilder: boolean;
  /** DB-level UNIQUE constraint enforcement via @Unique() */
  uniqueEnforcement: boolean;
  /** DB-level FK constraint enforcement: ON DELETE CASCADE / RESTRICT / SET NULL */
  referentialIntegrity: boolean;
  /** DB-level CHECK constraint enforcement via @Check() expressions */
  checkConstraints: boolean;
  /**
   * Rich column types round-trip with identical JS types: bigint columns as
   * JS bigint, decimal columns as precision-preserving string, binary columns
   * as Node Buffer. Mongo (BSON Long/Decimal128/Binary) and Redis (binary
   * stored as string) cannot satisfy all three through the shared deserialise.
   */
  richColumnTypes: boolean;
  /**
   * upsert() honours `conflictOn` to resolve conflicts on a non-PK unique
   * column. Mongo and Redis reject conflictOn by design (NotSupportedError).
   */
  upsertConflictColumns: boolean;
  /** Table inheritance strategies */
  inheritance: {
    /** Single-table inheritance: all subtypes share one table with discriminator column */
    singleTable: boolean;
    /** Joined inheritance: each subtype has its own table, JOINed on PK */
    joined: boolean;
  };
  /** Transaction semantics — split by capability level */
  transactions: {
    /** Basic commit/rollback: error in callback undoes all writes */
    rollback: boolean;
    /** Nested ctx.transaction() via SAVEPOINT with independent rollback */
    savepoints: boolean;
  };
  /** Field-level encryption via @Encrypted decorator */
  encryption: boolean;
  /** Migration capabilities */
  migrations: {
    /** Core lifecycle: apply, rollback, status, getRecords, resolve* */
    lifecycle: boolean;
    /** Schema generation: generateMigration, generateBaseline */
    generation: boolean;
  };
};

export type TckDriverHandle = {
  repository<E extends IEntity>(target: Constructor<E>): IProteusRepository<E>;
  clear(): Promise<void>;
  teardown(): Promise<void>;
};

export type TckDriverFactory = {
  driver: MetaDriver;
  capabilities: TckCapabilities;
  /**
   * Build a source/handle for the given entities under the given naming
   * strategy. `naming` defaults to "none"; SQL driver harnesses run the suite
   * under every strategy so key→column resolution is exercised, not just the
   * "none" case where keys and columns coincide.
   *
   * When `cache` is true the source is built with a query cache adapter, so the
   * full behavioural suite also exercises the CachingRepository layer (read
   * caching + write invalidation + entity serialisation round-trip), not just
   * the uncached inner repository.
   */
  setup(
    entities: Array<Constructor<IEntity>>,
    naming?: NamingStrategy,
    cache?: boolean,
  ): Promise<TckDriverHandle>;
};
