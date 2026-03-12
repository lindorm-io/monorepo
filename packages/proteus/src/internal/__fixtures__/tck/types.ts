import type { Constructor } from "@lindorm/types";
import type { IEntity, IProteusRepository } from "../../../interfaces";
import type { MetaDriver } from "../../entity/types/metadata";

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
  /** Atomic increment() / decrement() without full entity load */
  atomicIncrements: boolean;
  /** source.queryBuilder() — where, orderBy, skip, take, select, aggregates, clone */
  queryBuilder: boolean;
  /** DB-level UNIQUE constraint enforcement via @Unique() */
  uniqueEnforcement: boolean;
  /** DB-level FK constraint enforcement: ON DELETE CASCADE / RESTRICT / SET NULL */
  referentialIntegrity: boolean;
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
  setup(entities: Array<Constructor<IEntity>>): Promise<TckDriverHandle>;
};
