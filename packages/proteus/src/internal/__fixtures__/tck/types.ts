import type { IAmphora } from "@lindorm/amphora";
import type { Constructor, Dict } from "@lindorm/types";
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
   * A `@Field("bigint")` column round-trips as a JS bigint holding the exact
   * value, including magnitudes beyond Number.MAX_SAFE_INTEGER.
   */
  bigintColumns: boolean;
  /**
   * A `@Field("decimal")` column round-trips in BOTH modes: default mode as a
   * JS number, `{ mode: "string" }` as an exact, precision-preserving string.
   * A driver that reads every numeric column through parseFloat carries the
   * number mode but loses the string mode, so it fails the pair.
   */
  decimalColumns: boolean;
  /**
   * A `@Field("binary")` column round-trips as a Node Buffer with byte
   * equality.
   */
  binaryColumns: boolean;
  /**
   * A `@TypedJson()` json/object/array field round-trips losslessly: nested
   * Date / Buffer / BigInt / `undefined` come back as the original types, an
   * update replaces the sidecar rather than leaving stale type metadata, and a
   * `select` projection carries the sidecar along with the data.
   */
  typedJson: boolean;
  /**
   * A `@Field("bigint")` column can serve as a `@Generated("increment")`
   * primary key: the driver mints the identity itself, hands it back as a JS
   * bigint, and that bigint round-trips through reads, writes and foreign
   * keys. A driver that mints a plain number, or that hands a bigint back as
   * a string/Long, cannot carry one.
   */
  bigintIdentity: boolean;
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
  /**
   * The exact Amphora instance the source encrypts through — exposed so the
   * encryption suite can prove which KEK actually sealed a field (the kid in the
   * ciphertext column equals the id of the key the source's `findSync` selects).
   * Same object the pipeline uses, so a spy on it observes the real selection.
   */
  amphora: IAmphora;
  repository<E extends IEntity>(target: Constructor<E>): IProteusRepository<E>;
  /**
   * Every STORED row of one entity, read straight off the driver with no
   * hydrate, decrypt or sidecar-join layer in between. Keys are storage-level
   * names (SQL columns, Redis hash fields, Mongo document keys, memory row
   * keys) and values are whatever the driver hands back.
   *
   * This is what lets a test prove a column really holds ciphertext. A
   * round-trip assertion cannot: it passes just as well when nothing was
   * encrypted at all.
   */
  readRawRows<E extends IEntity>(target: Constructor<E>): Promise<Array<Dict>>;
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
