import type { IAmphora } from "@lindorm/amphora";
import type { ILogger } from "@lindorm/logger";
import type { Constructor, DeepPartial, Dict, Predicate } from "@lindorm/types";
import type { Redis } from "ioredis";
import type {
  IEntity,
  IDeleteQueryBuilder,
  IInsertQueryBuilder,
  IProteusQueryBuilder,
  IUpdateQueryBuilder,
} from "../../../../interfaces";
import type { WriteResult } from "../../../../interfaces/InsertQueryBuilder";
import type { LockMode } from "../../../../types/find-options";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import type { FilterRegistry } from "#internal/utils/query/filter-registry";
import { QueryBuilder } from "../../../../classes/QueryBuilder";
import { NotSupportedError } from "../../../../errors/NotSupportedError";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError";
import { Predicated } from "@lindorm/utils";
import { defaultHydrateEntity } from "#internal/entity/utils/default-hydrate-entity";
import { generateAutoFilters } from "#internal/entity/metadata/auto-filters";
import { resolveFilters } from "#internal/utils/query/resolve-filters";
import { mergeSystemFilterOverrides } from "#internal/utils/query/merge-system-filter-overrides";
import { buildEntityKey, buildEntityKeyFromRow } from "../utils/build-entity-key";
import { buildScanPattern } from "../utils/build-scan-pattern";
// deserializeHash parses array/json/object fields from JSON strings to native JS
// types via JSON.parse before criteria matching — complex predicates ($all, $has,
// $overlap etc.) work correctly on deserialized values.
import { deserializeHash } from "../utils/deserialize-hash";
import { serializeHash } from "../utils/serialize-hash";
import { extractExactPk } from "../utils/is-pk-exact";
import { scanEntityKeys } from "../utils/scan-entity-keys";
import { applyRedisAutoIncrement } from "../utils/redis-auto-increment";
import { resolveInheritanceRoot } from "#internal/entity/utils/resolve-inheritance-root";
import { resolvePolymorphicMetadata } from "#internal/entity/utils/resolve-polymorphic-metadata";
import { RedisDriverError } from "../errors/RedisDriverError";
import { RedisDuplicateKeyError } from "../errors/RedisDuplicateKeyError";
import { encryptFieldValue } from "#internal/entity/utils/encrypt-field-value";
import { flattenEmbeddedCriteria } from "#internal/utils/query/flatten-embedded-criteria";
import { applyOrdering } from "#internal/utils/query/apply-ordering";
import {
  computeAggregateFromValues,
  extractNumericValues,
} from "#internal/utils/query/compute-in-memory-aggregate";
import { scanAllRows as scanAllRowsShared } from "../utils/scan-all-rows";

// ─── Lock mode guard ──────────────────────────────────────────────────────────

const guardRedisLockMode = (mode: LockMode): void => {
  throw new NotSupportedError(
    `Lock mode "${mode}" is not supported by the Redis driver — Redis provides no locking semantics`,
  );
};

const execPipeline = async (
  pipeline: ReturnType<Redis["pipeline"]>,
): Promise<Array<[Error | null, any]>> => {
  const results = await pipeline.exec();
  if (!results) {
    throw new ProteusRepositoryError("Pipeline execution returned null");
  }
  return results;
};

/**
 * Log a warning for a per-slot pipeline error during read operations.
 */
const warnOnReadPipelineError = (
  err: Error,
  slotIndex: number,
  operation: string,
  logger?: ILogger,
): void => {
  logger?.warn(`Pipeline slot error in ${operation}`, { slotIndex, error: err });
};

// ─── RedisQueryBuilder ───────────────────────────────────────────────────────

export class RedisQueryBuilder<E extends IEntity> extends QueryBuilder<E> {
  private readonly storageTarget: Constructor<IEntity>;
  private readonly client: Redis;
  private readonly namespace: string | null;
  private readonly logger: ILogger | undefined;
  private readonly filterRegistry: FilterRegistry;
  private readonly amphora: IAmphora | undefined;

  public constructor(
    metadata: EntityMetadata,
    client: Redis,
    namespace: string | null,
    logger?: ILogger,
    filterRegistry?: FilterRegistry,
    amphora?: IAmphora,
  ) {
    super(metadata);
    this.storageTarget = resolveInheritanceRoot(
      metadata.target as Constructor<E>,
      metadata,
    );
    this.client = client;
    this.namespace = namespace;
    this.logger = logger;
    this.filterRegistry = filterRegistry ?? new Map();
    this.amphora = amphora;
  }

  // ─── Lock mode ──────────────────────────────────────────────────────

  public lock(mode: LockMode): this {
    guardRedisLockMode(mode);
    this.state.lock = mode;
    return this;
  }

  // ─── Override raw SQL methods to throw ─────────────────────────────

  public override whereRaw(): this {
    throw new NotSupportedError("whereRaw is not supported by the Redis driver");
  }

  public override andWhereRaw(): this {
    throw new NotSupportedError("andWhereRaw is not supported by the Redis driver");
  }

  public override orWhereRaw(): this {
    throw new NotSupportedError("orWhereRaw is not supported by the Redis driver");
  }

  public override selectRaw(): this {
    throw new NotSupportedError("selectRaw is not supported by the Redis driver");
  }

  public override groupBy(): this {
    throw new NotSupportedError("groupBy is not supported by the Redis driver");
  }

  public override having(): this {
    throw new NotSupportedError("having is not supported by the Redis driver");
  }

  public override andHaving(): this {
    throw new NotSupportedError("andHaving is not supported by the Redis driver");
  }

  public override orHaving(): this {
    throw new NotSupportedError("orHaving is not supported by the Redis driver");
  }

  public override havingRaw(): this {
    throw new NotSupportedError("havingRaw is not supported by the Redis driver");
  }

  public override andHavingRaw(): this {
    throw new NotSupportedError("andHavingRaw is not supported by the Redis driver");
  }

  public override orHavingRaw(): this {
    throw new NotSupportedError("orHavingRaw is not supported by the Redis driver");
  }

  public override window(): this {
    throw new NotSupportedError("window is not supported by the Redis driver");
  }

  // ─── Terminal methods ─────────────────────────────────────────────

  public clone(): IProteusQueryBuilder<E> {
    const cloned = new RedisQueryBuilder<E>(
      this.metadata,
      this.client,
      this.namespace,
      this.logger,
      this.filterRegistry,
      this.amphora,
    );
    cloned.state = this.cloneState();
    return cloned;
  }

  public toQuery(): unknown {
    return { state: this.state, driver: "redis" };
  }

  public async getOne(): Promise<E | null> {
    const rows = await this.resolveRows();
    if (rows.length === 0) return null;
    return this.hydrateRow(rows[0]);
  }

  public async getOneOrFail(): Promise<E> {
    const entity = await this.getOne();
    if (!entity) {
      throw new ProteusRepositoryError(`Entity "${this.metadata.entity.name}" not found`);
    }
    return entity;
  }

  public async getMany(): Promise<Array<E>> {
    const rows = await this.resolveRows();
    return rows.map((row) => this.hydrateRow(row));
  }

  public async getManyAndCount(): Promise<[Array<E>, number]> {
    const allRows = await this.resolveRows(/* forCount */ true);
    const totalCount = allRows.length;

    let paginatedRows = allRows;
    if (this.state.skip != null && this.state.skip > 0) {
      paginatedRows = paginatedRows.slice(this.state.skip);
    }
    if (this.state.take != null) {
      paginatedRows = paginatedRows.slice(0, this.state.take);
    }

    const entities = paginatedRows.map((row) => this.hydrateRow(row));
    return [entities, totalCount];
  }

  public async count(): Promise<number> {
    const rows = await this.resolveRows(/* forCount */ true);
    return rows.length;
  }

  public async exists(): Promise<boolean> {
    const rows = await this.resolveRows();
    return rows.length > 0;
  }

  public async getRawRows<
    T extends Record<string, unknown> = Record<string, unknown>,
  >(): Promise<Array<T>> {
    const rows = await this.resolveRows();
    return rows as unknown as Array<T>;
  }

  // ─── Aggregates ───────────────────────────────────────────────────

  public async sum(field: keyof E): Promise<number | null> {
    return this.computeAggregate("sum", field);
  }

  public async average(field: keyof E): Promise<number | null> {
    return this.computeAggregate("avg", field);
  }

  public async minimum(field: keyof E): Promise<number | null> {
    return this.computeAggregate("min", field);
  }

  public async maximum(field: keyof E): Promise<number | null> {
    return this.computeAggregate("max", field);
  }

  // ─── Write builders ───────────────────────────────────────────────

  /**
   * Create an insert query builder. Note: QB inserts bypass entity lifecycle
   * hooks (beforeInsert/afterInsert), validation, relation processing, and
   * subscriber events. Use repository.insert() for full lifecycle support.
   */
  public insert(): IInsertQueryBuilder<E> {
    return new RedisInsertBuilder<E>(
      this.client,
      this.metadata,
      this.namespace,
      this.amphora,
    );
  }

  /**
   * Create an update query builder. Note: QB updates bypass entity lifecycle
   * hooks (beforeUpdate/afterUpdate), validation, relation processing, and
   * subscriber events. Use repository.save() for full lifecycle support.
   */
  public update(): IUpdateQueryBuilder<E> {
    this.guardAppendOnlyWrite("update");
    return new RedisUpdateBuilder<E>(
      this.client,
      this.metadata,
      this.namespace,
      this.filterRegistry,
      this.logger,
      this.amphora,
    );
  }

  /**
   * Create a delete query builder. Note: QB deletes bypass entity lifecycle
   * hooks (beforeDestroy/afterDestroy), relation cascade/orphan processing,
   * and subscriber events. Use repository.destroy() for full lifecycle support.
   */
  public delete(): IDeleteQueryBuilder<E> {
    this.guardAppendOnlyWrite("delete");
    return new RedisDeleteBuilder<E>(
      this.client,
      this.metadata,
      this.namespace,
      false,
      this.filterRegistry,
      this.logger,
      this.amphora,
    );
  }

  /**
   * Create a soft-delete query builder. Note: QB soft-deletes bypass entity
   * lifecycle hooks, relation processing, and subscriber events.
   * Use repository.softDestroy() for full lifecycle support.
   */
  public softDelete(): IDeleteQueryBuilder<E> {
    this.guardAppendOnlyWrite("softDelete");
    return new RedisDeleteBuilder<E>(
      this.client,
      this.metadata,
      this.namespace,
      true,
      this.filterRegistry,
      this.logger,
      this.amphora,
    );
  }

  // ─── Private ──────────────────────────────────────────────────────

  /**
   * Resolve filtered, ordered rows from Redis.
   * @param forCount - When true, skips pagination (skip/take) so the caller
   *   can get the total count before pagination is applied (used by getManyAndCount/count).
   */
  private async resolveRows(forCount?: boolean): Promise<Array<Dict>> {
    let rows: Array<Dict>;

    // PK-exact optimization: if the first predicate is a simple PK equality,
    // use direct HGETALL instead of SCAN
    const firstPredicate = this.state.predicates[0]?.predicate;
    const pkValues = firstPredicate
      ? extractExactPk(firstPredicate, this.metadata.primaryKeys)
      : null;

    if (pkValues && this.state.predicates.length === 1) {
      const redisKey = buildEntityKey(this.storageTarget, pkValues, this.namespace);
      const hash = await this.client.hgetall(redisKey);
      const row = deserializeHash(hash, this.metadata.fields, this.metadata.relations);
      rows = row ? [row] : [];
    } else {
      rows = await this.scanAllRows();
    }

    // Version system filter
    const versionEndField = this.metadata.fields.find(
      (f) => f.decorator === "VersionEndDate",
    );
    if (versionEndField && !this.state.versionTimestamp && !this.state.withAllVersions) {
      rows = rows.filter((r) => r[versionEndField.key] == null);
    } else if (versionEndField && this.state.versionTimestamp) {
      const ts = this.state.versionTimestamp.getTime();
      const versionStartField = this.metadata.fields.find(
        (f) => f.decorator === "VersionStartDate",
      );
      rows = rows.filter((r) => {
        const start = r[versionStartField?.key ?? "versionStartDate"];
        const end = r[versionEndField.key];
        const startTime =
          start instanceof Date ? start.getTime() : start ? new Date(start).getTime() : 0;
        const endTime =
          end == null
            ? Infinity
            : end instanceof Date
              ? end.getTime()
              : new Date(end).getTime();
        return startTime <= ts && ts < endTime;
      });
    }

    // Apply system + user-defined @Filter predicates (includes __softDelete/__scope)
    const qbOverrides =
      Object.keys(this.state.filterOverrides).length > 0
        ? this.state.filterOverrides
        : undefined;
    const systemOverrides = mergeSystemFilterOverrides(
      qbOverrides,
      this.state.withDeleted,
      this.state.withoutScope,
    );
    const resolveMetaFilters = this.metadata.filters?.length
      ? this.metadata.filters
      : generateAutoFilters(this.metadata.fields);
    const metaFilters = resolveFilters(
      resolveMetaFilters,
      this.filterRegistry,
      systemOverrides,
    );
    const allFilters = [...metaFilters, ...this.state.resolvedFilters];
    for (const filter of allFilters) {
      rows = Predicated.filter(rows as Array<Record<string, unknown>>, filter.predicate);
    }

    // Save the post-system-filter base set for OR predicates
    const baseRows = [...rows];

    // Apply predicates (flatten embedded criteria for dotted-key row matching)
    for (const entry of this.state.predicates) {
      const flatPredicate = flattenEmbeddedCriteria<E>(entry.predicate, this.metadata);
      if (entry.conjunction === "and") {
        rows = Predicated.filter(rows as Array<Record<string, unknown>>, flatPredicate);
      } else {
        // OR: union with matching rows from the filtered base set.
        // Use index-based dedup to avoid object-identity fragility with Set.has().
        const orRows = Predicated.filter(
          baseRows as Array<Record<string, unknown>>,
          flatPredicate,
        );
        const existingIndices = new Set<number>();
        for (const r of rows) {
          const idx = baseRows.indexOf(r);
          if (idx !== -1) existingIndices.add(idx);
        }
        for (const orRow of orRows) {
          const idx = baseRows.indexOf(orRow);
          if (idx === -1 || !existingIndices.has(idx)) {
            rows.push(orRow);
            if (idx !== -1) existingIndices.add(idx);
          }
        }
      }
    }

    // Distinct
    // NOTE: distinct deduplication uses JSON.stringify on full row objects.
    // This is O(N * row_size) — not suitable for large result sets with complex entities.
    if (this.state.distinct) {
      const seen = new Set<string>();
      rows = rows.filter((r) => {
        const key = JSON.stringify(
          this.state.selections
            ? Object.fromEntries(
                (this.state.selections as Array<string>).map((k) => [k, r[k]]),
              )
            : r,
        );
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // Ordering: explicit .orderBy() > @DefaultOrder > none
    const effectiveOrderBy = this.state.orderBy ?? this.metadata.defaultOrder;
    if (effectiveOrderBy) {
      rows = applyOrdering<E>(
        rows,
        effectiveOrderBy as Partial<Record<keyof E, "ASC" | "DESC">>,
      );
    }

    // Pagination
    if (!forCount) {
      if (this.state.skip != null && this.state.skip > 0) {
        rows = rows.slice(this.state.skip);
      }
      if (this.state.take != null) {
        rows = rows.slice(0, this.state.take);
      }
    }

    // Select projection
    if (this.state.selections && this.state.selections.length > 0) {
      const keys = this.state.selections as Array<string>;
      rows = rows.map((r) => {
        const projected: Dict = {};
        for (const k of keys) {
          if (k in r) projected[k] = r[k];
        }
        return projected;
      });
    }

    return rows;
  }

  private async scanAllRows(): Promise<Array<Dict>> {
    const pattern = buildScanPattern(this.storageTarget, this.namespace);
    return scanAllRowsShared(
      this.client,
      pattern,
      this.metadata.fields,
      this.metadata.relations,
      this.logger,
    );
  }

  private hydrateRow(row: Dict): E {
    const effectiveMetadata = resolvePolymorphicMetadata(row, this.metadata);
    return defaultHydrateEntity<E>(structuredClone(row), effectiveMetadata, {
      snapshot: true,
      hooks: true,
      amphora: this.amphora,
    });
  }

  private async computeAggregate(
    type: "sum" | "avg" | "min" | "max",
    field: keyof E,
  ): Promise<number | null> {
    const rows = await this.resolveRows(true);
    if (rows.length === 0) return null;
    return computeAggregateFromValues(
      type,
      extractNumericValues(rows as Array<Record<string, unknown>>, field as string),
    );
  }
}

// ─── Write Builders ───────────────────────────────────────────────────────────

class RedisInsertBuilder<E extends IEntity> implements IInsertQueryBuilder<E> {
  private readonly client: Redis;
  private readonly metadata: EntityMetadata;
  private readonly storageTarget: Constructor<IEntity>;
  private readonly namespace: string | null;
  private readonly amphora: IAmphora | undefined;
  private data: Array<DeepPartial<E>> = [];

  public constructor(
    client: Redis,
    metadata: EntityMetadata,
    namespace: string | null,
    amphora?: IAmphora,
  ) {
    this.client = client;
    this.metadata = metadata;
    this.storageTarget = resolveInheritanceRoot(
      metadata.target as Constructor<E>,
      metadata,
    );
    this.namespace = namespace;
    this.amphora = amphora;
  }

  public values(data: Array<DeepPartial<E>>): this {
    this.data = data;
    return this;
  }

  public returning(): this {
    // No-op for Redis driver -- all fields are always returned
    return this;
  }

  public async execute(): Promise<WriteResult<E>> {
    // QB insert is not supported for joined inheritance children (Redis doesn't
    // support joined inheritance; throw for API consistency).
    if (
      this.metadata.inheritance?.strategy === "joined" &&
      this.metadata.inheritance.discriminatorValue != null
    ) {
      throw new ProteusRepositoryError(
        `QB insert is not supported for joined inheritance child "${this.metadata.entity.name}". Use repository.insert() instead.`,
      );
    }

    const results: Array<E> = [];

    for (const item of this.data) {
      const row: Dict = {};
      for (const field of this.metadata.fields) {
        if (field.key in (item as any)) {
          let value = (item as any)[field.key];
          if (value != null && field.transform) value = field.transform.to(value);
          if (value != null && field.encrypted && this.amphora) {
            value = encryptFieldValue(
              value,
              field.encrypted.predicate,
              this.amphora,
              field.key,
              this.metadata.entity.name,
            );
          }
          row[field.key] = value;
        }
      }

      // For single-table children, inject the discriminator value so the row
      // can be found by carRepo.find() which filters by __discriminator.
      if (
        this.metadata.inheritance?.strategy === "single-table" &&
        this.metadata.inheritance.discriminatorValue != null
      ) {
        row[this.metadata.inheritance.discriminatorField] =
          this.metadata.inheritance.discriminatorValue;
      }

      await applyRedisAutoIncrement(this.client, row, this.metadata, this.namespace);

      const redisKey = buildEntityKeyFromRow(
        this.storageTarget,
        row,
        this.metadata,
        this.namespace,
      );

      const exists = await this.client.exists(redisKey);
      if (exists) {
        throw new RedisDuplicateKeyError(
          `Duplicate primary key for "${this.metadata.entity.name}": ${redisKey}`,
          { debug: { entityName: this.metadata.entity.name, redisKey } },
        );
      }

      const hash = serializeHash(row, this.metadata.fields, this.metadata.relations);

      if (Object.keys(hash).length === 0) {
        throw new RedisDriverError(
          `Cannot insert entity "${this.metadata.entity.name}" — all fields serialized to null, which would create an invisible Redis key`,
        );
      }

      await this.client.hset(redisKey, hash);

      // Apply expiry if the entity has an ExpiryDate field (mirrors RedisExecutor.applyExpiry)
      const expiryField = this.metadata.fields.find((f) => f.decorator === "ExpiryDate");
      if (expiryField) {
        const expiresAt = row[expiryField.key];
        if (expiresAt == null) {
          await this.client.persist(redisKey);
        } else {
          const expiryDate =
            expiresAt instanceof Date ? expiresAt : new Date(expiresAt as string);
          if (isNaN(expiryDate.getTime())) {
            throw new RedisDriverError(
              `Invalid expiry date for "${this.metadata.entity.name}": ${String(expiresAt)}`,
            );
          }
          await this.client.pexpireat(redisKey, expiryDate.getTime());
        }
      }

      const entity = defaultHydrateEntity<E>(
        structuredClone(row),
        resolvePolymorphicMetadata(row, this.metadata),
        { snapshot: false, hooks: false, amphora: this.amphora },
      );
      results.push(entity);
    }

    return { rows: results, rowCount: results.length };
  }
}

class RedisUpdateBuilder<E extends IEntity> implements IUpdateQueryBuilder<E> {
  private readonly client: Redis;
  private readonly metadata: EntityMetadata;
  private readonly storageTarget: Constructor<IEntity>;
  private readonly namespace: string | null;
  private readonly filterRegistry: FilterRegistry;
  private readonly logger: ILogger | undefined;
  private readonly amphora: IAmphora | undefined;
  private updateData: DeepPartial<E> | null = null;
  private predicates: Array<{ predicate: Predicate<E>; conjunction: "and" | "or" }> = [];

  public constructor(
    client: Redis,
    metadata: EntityMetadata,
    namespace: string | null,
    filterRegistry: FilterRegistry,
    logger?: ILogger,
    amphora?: IAmphora,
  ) {
    this.client = client;
    this.metadata = metadata;
    this.storageTarget = resolveInheritanceRoot(
      metadata.target as Constructor<E>,
      metadata,
    );
    this.namespace = namespace;
    this.filterRegistry = filterRegistry;
    this.logger = logger;
    this.amphora = amphora;
  }

  public set(data: DeepPartial<E>): this {
    this.updateData = data;
    return this;
  }

  public where(criteria: Predicate<E>): this {
    this.predicates = [{ predicate: criteria, conjunction: "and" }];
    return this;
  }

  public andWhere(criteria: Predicate<E>): this {
    this.predicates.push({ predicate: criteria, conjunction: "and" });
    return this;
  }

  public orWhere(criteria: Predicate<E>): this {
    this.predicates.push({ predicate: criteria, conjunction: "or" });
    return this;
  }

  public returning(): this {
    // No-op for Redis driver -- all fields are always returned
    return this;
  }

  public async execute(): Promise<WriteResult<E>> {
    if (!this.updateData) return { rows: [], rowCount: 0 };

    const pattern = buildScanPattern(this.storageTarget, this.namespace);
    const keys = await scanEntityKeys(this.client, pattern);

    if (keys.length === 0) return { rows: [], rowCount: 0 };

    // Fetch all hashes via pipeline
    const fetchPipeline = this.client.pipeline();
    for (const key of keys) {
      fetchPipeline.hgetall(key);
    }
    const fetchResults = await execPipeline(fetchPipeline);

    // Apply system filters: default-on filters (includes __softDelete) + version
    let keyRowPairs: Array<{ key: string; row: Dict }> = [];
    for (let i = 0; i < fetchResults.length; i++) {
      const [err, hash] = fetchResults[i];
      if (err) {
        warnOnReadPipelineError(err, i, "RedisUpdateBuilder.execute", this.logger);
        continue;
      }
      const row = deserializeHash(
        hash as Record<string, string>,
        this.metadata.fields,
        this.metadata.relations,
      );
      if (!row) continue;
      keyRowPairs.push({ key: keys[i], row });
    }

    // Version system filter
    const versionEndField = this.metadata.fields.find(
      (f) => f.decorator === "VersionEndDate",
    );
    if (versionEndField) {
      keyRowPairs = keyRowPairs.filter((p) => p.row[versionEndField.key] == null);
    }

    // Apply system filters (soft-delete, scope)
    // Use index-based dedup to avoid object-identity fragility with Set.has()
    const updateMetaFilters = this.metadata.filters?.length
      ? this.metadata.filters
      : generateAutoFilters(this.metadata.fields);
    const resolved = resolveFilters(updateMetaFilters, this.filterRegistry, undefined);
    if (resolved.length > 0) {
      let filteredRows = keyRowPairs.map((p) => p.row);
      for (const filter of resolved) {
        filteredRows = Predicated.filter(
          filteredRows as Array<Record<string, unknown>>,
          filter.predicate,
        );
      }
      const survivingIndices = new Set<number>();
      for (const fr of filteredRows) {
        const idx = keyRowPairs.findIndex((p) => p.row === fr);
        if (idx !== -1) survivingIndices.add(idx);
      }
      keyRowPairs = keyRowPairs.filter((_, i) => survivingIndices.has(i));
    }

    // Apply predicate matching
    const matched: Array<{ key: string; row: Dict }> = [];
    for (const pair of keyRowPairs) {
      if (this.matchesPredicates(pair.row)) {
        matched.push(pair);
      }
    }

    if (matched.length === 0) return { rows: [], rowCount: 0 };

    // Apply updates
    const updatePipeline = this.client.pipeline();
    const results: Array<E> = [];

    for (const { key, row } of matched) {
      const updateHash: Record<string, string> = {};
      for (const [fieldKey, value] of Object.entries(
        this.updateData as Record<string, unknown>,
      )) {
        row[fieldKey] = value;
        if (value == null) {
          updatePipeline.hdel(key, fieldKey);
          continue;
        }
        const field = this.metadata.fields.find((f) => f.key === fieldKey);
        let transformed = field?.transform ? field.transform.to(value) : value;
        if (transformed != null && field?.encrypted && this.amphora) {
          transformed = encryptFieldValue(
            transformed,
            field.encrypted.predicate,
            this.amphora,
            field.key,
            this.metadata.entity.name,
          );
        }
        updateHash[fieldKey] = String(transformed);
      }
      if (Object.keys(updateHash).length > 0) {
        updatePipeline.hset(key, updateHash);
      }
      const entity = defaultHydrateEntity<E>(
        structuredClone(row),
        resolvePolymorphicMetadata(row, this.metadata),
        { snapshot: false, hooks: false, amphora: this.amphora },
      );
      results.push(entity);
    }

    await execPipeline(updatePipeline);

    return { rows: results, rowCount: results.length };
  }

  private matchesPredicates(row: Record<string, unknown>): boolean {
    if (this.predicates.length === 0) return true;
    const flat0 = flattenEmbeddedCriteria<E>(this.predicates[0].predicate, this.metadata);
    let result = Predicated.match(row, flat0);
    for (let i = 1; i < this.predicates.length; i++) {
      const { predicate, conjunction } = this.predicates[i];
      const flatPred = flattenEmbeddedCriteria<E>(predicate, this.metadata);
      const m = Predicated.match(row, flatPred);
      result = conjunction === "or" ? result || m : result && m;
    }
    return result;
  }
}

class RedisDeleteBuilder<E extends IEntity> implements IDeleteQueryBuilder<E> {
  private readonly client: Redis;
  private readonly metadata: EntityMetadata;
  private readonly storageTarget: Constructor<IEntity>;
  private readonly namespace: string | null;
  private readonly soft: boolean;
  private readonly filterRegistry: FilterRegistry;
  private readonly logger: ILogger | undefined;
  private readonly amphora: IAmphora | undefined;
  private predicates: Array<{ predicate: Predicate<E>; conjunction: "and" | "or" }> = [];

  public constructor(
    client: Redis,
    metadata: EntityMetadata,
    namespace: string | null,
    soft: boolean,
    filterRegistry: FilterRegistry,
    logger?: ILogger,
    amphora?: IAmphora,
  ) {
    this.client = client;
    this.metadata = metadata;
    this.storageTarget = resolveInheritanceRoot(
      metadata.target as Constructor<E>,
      metadata,
    );
    this.namespace = namespace;
    this.soft = soft;
    this.filterRegistry = filterRegistry;
    this.logger = logger;
    this.amphora = amphora;
  }

  public where(criteria: Predicate<E>): this {
    this.predicates = [{ predicate: criteria, conjunction: "and" }];
    return this;
  }

  public andWhere(criteria: Predicate<E>): this {
    this.predicates.push({ predicate: criteria, conjunction: "and" });
    return this;
  }

  public orWhere(criteria: Predicate<E>): this {
    this.predicates.push({ predicate: criteria, conjunction: "or" });
    return this;
  }

  public returning(): this {
    // No-op for Redis driver -- all fields are always returned
    return this;
  }

  public async execute(): Promise<WriteResult<E>> {
    const pattern = buildScanPattern(this.storageTarget, this.namespace);
    const keys = await scanEntityKeys(this.client, pattern);

    if (keys.length === 0) return { rows: [], rowCount: 0 };

    // Fetch all hashes via pipeline
    const fetchPipeline = this.client.pipeline();
    for (const key of keys) {
      fetchPipeline.hgetall(key);
    }
    const fetchResults = await execPipeline(fetchPipeline);

    // Build key-row pairs
    let keyRowPairs: Array<{ key: string; row: Dict }> = [];
    for (let i = 0; i < fetchResults.length; i++) {
      const [err, hash] = fetchResults[i];
      if (err) {
        warnOnReadPipelineError(err, i, "RedisDeleteBuilder.execute", this.logger);
        continue;
      }
      const row = deserializeHash(
        hash as Record<string, string>,
        this.metadata.fields,
        this.metadata.relations,
      );
      if (!row) continue;
      keyRowPairs.push({ key: keys[i], row });
    }

    // Version system filter
    const versionEndField = this.metadata.fields.find(
      (f) => f.decorator === "VersionEndDate",
    );
    if (versionEndField) {
      keyRowPairs = keyRowPairs.filter((p) => p.row[versionEndField.key] == null);
    }

    // Apply system filters (soft-delete, scope)
    // Use index-based dedup to avoid object-identity fragility with Set.has()
    const deleteMetaFilters = this.metadata.filters?.length
      ? this.metadata.filters
      : generateAutoFilters(this.metadata.fields);
    const resolved = resolveFilters(deleteMetaFilters, this.filterRegistry, undefined);
    if (resolved.length > 0) {
      let filteredRows = keyRowPairs.map((p) => p.row);
      for (const filter of resolved) {
        filteredRows = Predicated.filter(
          filteredRows as Array<Record<string, unknown>>,
          filter.predicate,
        );
      }
      const survivingIndices = new Set<number>();
      for (const fr of filteredRows) {
        const idx = keyRowPairs.findIndex((p) => p.row === fr);
        if (idx !== -1) survivingIndices.add(idx);
      }
      keyRowPairs = keyRowPairs.filter((_, i) => survivingIndices.has(i));
    }

    // Apply predicate matching
    const matched: Array<{ key: string; row: Dict }> = [];
    for (const pair of keyRowPairs) {
      if (this.matchesPredicates(pair.row)) {
        matched.push(pair);
      }
    }

    if (matched.length === 0) return { rows: [], rowCount: 0 };

    const results: Array<E> = [];
    const deleteField = this.metadata.fields.find((f) => f.decorator === "DeleteDate");

    if (this.soft && !deleteField) {
      throw new NotSupportedError(
        "Entity does not support soft delete (missing @DeleteDate field)",
      );
    }

    if (this.soft) {
      const now = new Date().toISOString();
      const softPipeline = this.client.pipeline();

      for (const { key, row } of matched) {
        if (deleteField) {
          softPipeline.hset(key, deleteField.key, now);
          row[deleteField.key] = new Date(now);
        }
        const entity = defaultHydrateEntity<E>(
          structuredClone(row),
          resolvePolymorphicMetadata(row, this.metadata),
          { snapshot: false, hooks: false, amphora: this.amphora },
        );
        results.push(entity);
      }

      await execPipeline(softPipeline);
    } else {
      const delPipeline = this.client.pipeline();

      for (const { key, row } of matched) {
        delPipeline.del(key);
        const entity = defaultHydrateEntity<E>(
          structuredClone(row),
          resolvePolymorphicMetadata(row, this.metadata),
          { snapshot: false, hooks: false, amphora: this.amphora },
        );
        results.push(entity);
      }

      await execPipeline(delPipeline);
    }

    return { rows: results, rowCount: results.length };
  }

  private matchesPredicates(row: Record<string, unknown>): boolean {
    if (this.predicates.length === 0) return true;
    const flat0 = flattenEmbeddedCriteria<E>(this.predicates[0].predicate, this.metadata);
    let result = Predicated.match(row, flat0);
    for (let i = 1; i < this.predicates.length; i++) {
      const { predicate, conjunction } = this.predicates[i];
      const flatPred = flattenEmbeddedCriteria<E>(predicate, this.metadata);
      const m = Predicated.match(row, flatPred);
      result = conjunction === "or" ? result || m : result && m;
    }
    return result;
  }
}
