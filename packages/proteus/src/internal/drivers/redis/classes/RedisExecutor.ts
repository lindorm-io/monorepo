import type { IAmphora } from "@lindorm/amphora";
import type { Constructor, DeepPartial, Dict, Predicate } from "@lindorm/types";
import type { ILogger } from "@lindorm/logger";
import type { Redis } from "ioredis";
import type { IEntity } from "../../../../interfaces";
import type { IRepositoryExecutor } from "../../../interfaces/RepositoryExecutor";
import type { DeleteOptions, FindOptions } from "../../../../types";
import type { EntityMetadata, QueryScope } from "#internal/entity/types/metadata";
import type { FilterRegistry } from "#internal/utils/query/filter-registry";
import { Predicated } from "@lindorm/utils";
import { defaultHydrateEntity } from "#internal/entity/utils/default-hydrate-entity";
import { generateAutoFilters } from "#internal/entity/metadata/auto-filters";
import { guardEmptyCriteria } from "#internal/utils/repository/guard-empty-criteria";
import {
  matchesRow,
  applySelect,
  applyResolvedFilters,
  applyPagination,
} from "#internal/utils/query/in-memory-row-ops";
import { mergeSystemFilterOverrides } from "#internal/utils/query/merge-system-filter-overrides";
import { resolveFilters } from "#internal/utils/query/resolve-filters";
import { applyOrdering } from "#internal/utils/query/apply-ordering";
import { buildPrimaryKeyDebug } from "#internal/utils/repository/build-pk-debug";
import { buildEntityKey, buildEntityKeyFromRow } from "../utils/build-entity-key";
import { buildScanPattern } from "../utils/build-scan-pattern";
import { dehydrateToRow } from "../utils/dehydrate-entity";
// deserializeHash parses array/json/object fields from JSON strings to native JS
// types via JSON.parse (see coerceFromString). This happens BEFORE any criteria
// matching (matchesRow/Predicated.filter), so complex predicate operators like
// $all, $has, $overlap work correctly on deserialized values.
import { deserializeHash } from "../utils/deserialize-hash";
import { extractExactPk } from "../utils/is-pk-exact";
import { scanAllRows } from "../utils/scan-all-rows";
import { scanEntityKeys } from "../utils/scan-entity-keys";
import { serializeHash } from "../utils/serialize-hash";
import { applyRedisAutoIncrement } from "../utils/redis-auto-increment";
import {
  VERSION_CHECK_HSET,
  GUARDED_HINCRBY,
  GUARDED_HINCRBYFLOAT,
  GUARDED_HSET,
} from "../utils/lua-scripts";
import { encryptFieldValue } from "#internal/entity/utils/encrypt-field-value";
import { flattenEmbeddedCriteria } from "#internal/utils/query/flatten-embedded-criteria";
import { resolveInheritanceRoot } from "#internal/entity/utils/resolve-inheritance-root";
import { resolvePolymorphicMetadata } from "#internal/entity/utils/resolve-polymorphic-metadata";
import { RedisDuplicateKeyError } from "../errors/RedisDuplicateKeyError";
import { RedisOptimisticLockError } from "../errors/RedisOptimisticLockError";
import { RedisDriverError } from "../errors/RedisDriverError";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate that a value produces a valid Date. Throws if the date is invalid.
 */
const validateDate = (value: unknown, context: string): Date => {
  const date = value instanceof Date ? value : new Date(value as string);
  if (isNaN(date.getTime())) {
    throw new RedisDriverError(`Invalid date value in ${context}: ${String(value)}`);
  }
  return date;
};

// ─── RedisExecutor ────────────────────────────────────────────────────────────

export class RedisExecutor<E extends IEntity> implements IRepositoryExecutor<E> {
  private readonly metadata: EntityMetadata;
  private readonly storageTarget: Constructor<IEntity>;
  private readonly client: Redis;
  private readonly namespace: string | null;
  private readonly deleteFieldKey: string | null;
  private readonly expiryFieldKey: string | null;
  private readonly versionFieldKey: string | null;
  private readonly filterRegistry: FilterRegistry;
  private readonly logger: ILogger | null;
  private readonly amphora: IAmphora | undefined;

  public constructor(
    metadata: EntityMetadata,
    client: Redis,
    namespace: string | null,
    filterRegistry?: FilterRegistry,
    logger?: ILogger,
    amphora?: IAmphora,
  ) {
    this.metadata = metadata;
    this.storageTarget = resolveInheritanceRoot(
      metadata.target as Constructor<E>,
      metadata,
    );
    this.client = client;
    this.namespace = namespace;
    this.deleteFieldKey =
      metadata.fields.find((f) => f.decorator === "DeleteDate")?.key ?? null;
    this.expiryFieldKey =
      metadata.fields.find((f) => f.decorator === "ExpiryDate")?.key ?? null;
    this.versionFieldKey =
      metadata.fields.find((f) => f.decorator === "Version")?.key ?? null;
    this.filterRegistry = filterRegistry ?? new Map();
    this.logger = logger ?? null;
    this.amphora = amphora;
  }

  // ─── Insert ───────────────────────────────────────────────────────────

  public async executeInsert(entity: E): Promise<E> {
    const row = dehydrateToRow(entity, this.metadata, this.amphora);

    await applyRedisAutoIncrement(this.client, row, this.metadata, this.namespace);

    const redisKey = buildEntityKeyFromRow(
      this.storageTarget,
      row,
      this.metadata,
      this.namespace,
    );

    // TOCTOU: EXISTS + HSET is not atomic. Accepted per architecture decision A19
    // because PKs are UUIDs, making collisions astronomically unlikely.
    const exists = await this.client.exists(redisKey);
    if (exists) {
      throw new RedisDuplicateKeyError(
        `Duplicate primary key for "${this.metadata.entity.name}": ${redisKey}`,
        { debug: { entityName: this.metadata.entity.name, redisKey } },
      );
    }

    const hash = serializeHash(row, this.metadata.fields, this.metadata.relations);

    // F-011: Guard against inserting an entity with all null fields —
    // HSET with no fields silently creates no key, making the entity invisible.
    if (Object.keys(hash).length === 0) {
      throw new RedisDriverError(
        "Cannot insert entity with all null fields — hash would be empty",
      );
    }

    await this.client.hset(redisKey, hash);

    await this.applyExpiry(redisKey, row);

    return this.hydrateFromRow(row);
  }

  // ─── Update ───────────────────────────────────────────────────────────

  public async executeUpdate(entity: E): Promise<E> {
    const row = dehydrateToRow(entity, this.metadata, this.amphora);
    const redisKey = buildEntityKeyFromRow(
      this.storageTarget,
      row,
      this.metadata,
      this.namespace,
    );

    const hash = serializeHash(row, this.metadata.fields, this.metadata.relations);
    const nullFields = this.collectNullFields(row);

    if (this.versionFieldKey) {
      // F-013: Versioned update is now atomic — null field deletion
      // happens inside the Lua script alongside HSET.
      await this.versionedUpdate(redisKey, hash, nullFields, row);
    } else {
      await this.unversionedUpdate(redisKey, hash);

      // HDEL fields that are now null — serializeHash omits them but HSET
      // does not remove pre-existing keys, so stale values would persist.
      if (nullFields.length > 0) {
        await this.client.hdel(redisKey, ...nullFields);
      }
    }

    await this.applyExpiry(redisKey, row);

    return this.hydrateFromRow(row);
  }

  // ─── Delete ───────────────────────────────────────────────────────────

  public async executeDelete(
    criteria: Predicate<E>,
    options?: DeleteOptions,
  ): Promise<void> {
    guardEmptyCriteria(criteria, "delete", RedisDriverError);
    criteria = flattenEmbeddedCriteria(criteria, this.metadata);

    let keys: Array<string>;

    // PK-exact optimization: when no discriminator filter is needed and criteria
    // exactly matches primary keys, resolve the key directly without SCAN.
    const hasDiscriminator = this.metadata.inheritance?.discriminatorValue != null;

    if (!hasDiscriminator) {
      keys = await this.resolveKeys(criteria, options?.limit);
    } else {
      // Use discriminator-filtered scan to scope by inheritance partition without
      // excluding soft-deleted rows (hard delete should be able to remove them)
      let keyRowPairs = await this.scanAndFilterWithDiscriminator(criteria);
      if (options?.limit) {
        keyRowPairs = keyRowPairs.slice(0, options.limit);
      }
      keys = keyRowPairs.map((p) => p.key);
    }

    if (keys.length === 0) return;

    const pipeline = this.client.pipeline();
    for (const key of keys) {
      pipeline.del(key);
    }

    // F-025: Check per-slot errors from pipeline
    const results = await this.execPipeline(pipeline);
    this.warnOnPipelineErrors(results, "executeDelete");
  }

  // ─── Soft Delete ──────────────────────────────────────────────────────

  public async executeSoftDelete(criteria: Predicate<E>): Promise<void> {
    // F-001: Guard against soft-deleting an entity that has no @DeleteDate field
    if (!this.deleteFieldKey) {
      throw new RedisDriverError(
        "Entity does not support soft delete (missing @DeleteDate field)",
      );
    }

    guardEmptyCriteria(criteria, "soft delete", RedisDriverError);
    criteria = flattenEmbeddedCriteria(criteria, this.metadata);

    const dfk = this.deleteFieldKey;
    const now = new Date().toISOString();
    const rows = await this.scanAndFilterWithDiscriminator(criteria);

    if (rows.length === 0) return;

    const pipeline = this.client.pipeline();
    for (const { key } of rows) {
      pipeline.hset(key, dfk, now);
    }

    // F-025: Check per-slot errors from pipeline
    const results = await this.execPipeline(pipeline);
    this.warnOnPipelineErrors(results, "executeSoftDelete");
  }

  // ─── Restore ──────────────────────────────────────────────────────────

  public async executeRestore(criteria: Predicate<E>): Promise<void> {
    // F-001: Guard against restoring an entity that has no @DeleteDate field
    if (!this.deleteFieldKey) {
      throw new RedisDriverError(
        "Entity does not support soft delete (missing @DeleteDate field)",
      );
    }

    guardEmptyCriteria(criteria, "restore", RedisDriverError);
    criteria = flattenEmbeddedCriteria(criteria, this.metadata);

    const dfk = this.deleteFieldKey;
    const rows = await this.scanAndFilterWithDiscriminator(criteria);

    if (rows.length === 0) return;

    const pipeline = this.client.pipeline();
    for (const { key } of rows) {
      pipeline.hdel(key, dfk);
    }

    // F-025: Check per-slot errors from pipeline
    const results = await this.execPipeline(pipeline);
    this.warnOnPipelineErrors(results, "executeRestore");
  }

  // ─── Delete Expired ───────────────────────────────────────────────────

  public async executeDeleteExpired(): Promise<void> {
    if (!this.expiryFieldKey) return;

    const pattern = buildScanPattern(this.storageTarget, this.namespace);
    const keys = await scanEntityKeys(this.client, pattern);

    if (keys.length === 0) return;

    const now = Date.now();
    const toDelete: Array<string> = [];

    // Batch HGET for the expiry field
    const pipeline = this.client.pipeline();
    for (const key of keys) {
      pipeline.hget(key, this.expiryFieldKey);
    }
    const results = await this.execPipeline(pipeline);

    for (let i = 0; i < keys.length; i++) {
      const [err, raw] = results[i];
      if (err || raw == null) continue;

      // F-026: Validate date before comparing
      const expiryDate = validateDate(raw as string, "executeDeleteExpired");
      if (expiryDate.getTime() < now) {
        toDelete.push(keys[i]);
      }
    }

    if (toDelete.length === 0) return;

    const delPipeline = this.client.pipeline();
    for (const key of toDelete) {
      delPipeline.del(key);
    }
    await this.execPipeline(delPipeline);
  }

  // ─── TTL ──────────────────────────────────────────────────────────────

  public async executeTtl(criteria: Predicate<E>): Promise<number | null> {
    if (!this.expiryFieldKey) return null;

    criteria = flattenEmbeddedCriteria(criteria, this.metadata);
    const pkValues = extractExactPk(criteria, this.metadata.primaryKeys);

    if (!pkValues) {
      throw new RedisDriverError("TTL requires an exact primary key lookup");
    }

    const redisKey = buildEntityKey(this.storageTarget, pkValues, this.namespace);
    const ttl = await this.client.pttl(redisKey);

    if (ttl === -2) {
      throw new RedisDriverError(
        `TTL failed: key not found for "${this.metadata.entity.name}"`,
        { debug: { redisKey } },
      );
    }

    // -1 means key exists but has no expiry
    return ttl === -1 ? null : ttl;
  }

  // ─── Find ─────────────────────────────────────────────────────────────

  public async executeFind(
    criteria: Predicate<E>,
    options: FindOptions<E>,
    _operationScope?: QueryScope,
  ): Promise<Array<E>> {
    criteria = flattenEmbeddedCriteria(criteria, this.metadata);
    let rows: Array<Dict>;

    const pkValues = extractExactPk(criteria, this.metadata.primaryKeys);

    if (pkValues) {
      // O(1) PK-exact lookup
      const redisKey = buildEntityKey(this.storageTarget, pkValues, this.namespace);
      const hash = await this.client.hgetall(redisKey);
      const row = deserializeHash(hash, this.metadata.fields, this.metadata.relations);
      rows = row ? [row] : [];
    } else {
      // SCAN + client-side filter
      rows = await this.doScanAllRows();
    }

    // F-037: Standardized filter ordering — version → system → criteria

    // 1. Apply version system filter
    rows = this.applyVersionFilter(rows, options);

    // 2. Apply system + user-defined @Filter predicates
    const filterOverrides = mergeSystemFilterOverrides(
      options.filters,
      options.withDeleted ?? false,
      options.withoutScope ?? false,
    );
    const metaFilters = this.metadata.filters?.length
      ? this.metadata.filters
      : generateAutoFilters(this.metadata.fields);
    const resolved = resolveFilters(metaFilters, this.filterRegistry, filterOverrides);
    rows = applyResolvedFilters(rows, resolved);

    // 3. Apply criteria predicate filter (always — PK-exact may have additional non-PK criteria)
    if (Object.keys(criteria).length > 0) {
      rows = Predicated.filter(rows as Array<Record<string, unknown>>, criteria);
    }

    // Apply ordering
    const effectiveOrder =
      options.order !== undefined
        ? options.order
        : this.metadata.defaultOrder
          ? (this.metadata.defaultOrder as Partial<Record<keyof E, "ASC" | "DESC">>)
          : undefined;
    rows = applyOrdering<E>(rows, effectiveOrder);

    // Apply pagination
    rows = applyPagination(rows, options);

    // Apply select
    const selections = (options.select as Array<string>) ?? null;
    if (selections && selections.length > 0) {
      rows = rows.map((r) => applySelect(r, selections));
    }

    // Hydrate
    return rows.map((row) => this.hydrateFromRow(row));
  }

  // ─── Count ────────────────────────────────────────────────────────────

  public async executeCount(
    criteria: Predicate<E>,
    options: FindOptions<E>,
  ): Promise<number> {
    criteria = flattenEmbeddedCriteria(criteria, this.metadata);
    // F-028: PK-exact optimization — avoid full SCAN when counting by PK
    const pkValues = extractExactPk(criteria, this.metadata.primaryKeys);

    let rows: Array<Dict>;

    if (pkValues) {
      const redisKey = buildEntityKey(this.storageTarget, pkValues, this.namespace);
      const hash = await this.client.hgetall(redisKey);
      const row = deserializeHash(hash, this.metadata.fields, this.metadata.relations);
      rows = row ? [row] : [];
    } else {
      rows = await this.doScanAllRows();
    }

    // F-037: Standardized filter ordering — version → system → criteria

    // 1. Apply version system filter
    rows = this.applyVersionFilter(rows, options);

    // 2. Apply system + user-defined @Filter predicates
    const filterOverrides = mergeSystemFilterOverrides(
      options.filters,
      options.withDeleted ?? false,
      options.withoutScope ?? false,
    );
    const countMetaFilters = this.metadata.filters?.length
      ? this.metadata.filters
      : generateAutoFilters(this.metadata.fields);
    const resolved = resolveFilters(
      countMetaFilters,
      this.filterRegistry,
      filterOverrides,
    );
    rows = applyResolvedFilters(rows, resolved);

    // 3. Apply criteria predicate filter
    if (Object.keys(criteria).length > 0) {
      rows = Predicated.filter(rows as Array<Record<string, unknown>>, criteria);
    }

    return rows.length;
  }

  // ─── Exists ───────────────────────────────────────────────────────────

  public async executeExists(criteria: Predicate<E>): Promise<boolean> {
    criteria = flattenEmbeddedCriteria(criteria, this.metadata);
    const pkValues = extractExactPk(criteria, this.metadata.primaryKeys);

    if (pkValues) {
      const redisKey = buildEntityKey(this.storageTarget, pkValues, this.namespace);
      const hash = await this.client.hgetall(redisKey);
      if (!hash || Object.keys(hash).length === 0) return false;

      const row = deserializeHash(hash, this.metadata.fields, this.metadata.relations);
      if (!row) return false;

      // Apply version filter (default: exclude ended versions)
      let rows = [row];
      rows = this.applyVersionFilter(rows, {});

      // Apply system filters (soft-delete, scope)
      const existsPkMetaFilters = this.metadata.filters?.length
        ? this.metadata.filters
        : generateAutoFilters(this.metadata.fields);
      const resolved = resolveFilters(
        existsPkMetaFilters,
        this.filterRegistry,
        undefined,
      );
      rows = applyResolvedFilters(rows, resolved);

      if (rows.length === 0) return false;

      // Apply full criteria predicate (not just PK fields)
      return matchesRow(rows[0], criteria);
    }

    // SCAN path
    let rows = await this.doScanAllRows();

    // F-022: Use applyVersionFilter instead of divergent inline logic
    rows = this.applyVersionFilter(rows, {});

    // Apply system filters
    const existsMetaFilters = this.metadata.filters?.length
      ? this.metadata.filters
      : generateAutoFilters(this.metadata.fields);
    const resolved = resolveFilters(existsMetaFilters, this.filterRegistry, undefined);
    rows = applyResolvedFilters(rows, resolved);

    for (const row of rows) {
      if (matchesRow(row, criteria)) return true;
    }

    return false;
  }

  // ─── Increment ────────────────────────────────────────────────────────

  public async executeIncrement(
    criteria: Predicate<E>,
    property: keyof E,
    value: number,
  ): Promise<void> {
    criteria = flattenEmbeddedCriteria(criteria, this.metadata);
    const field = this.metadata.fields.find((f) => f.key === (property as string));
    if (field?.encrypted) {
      throw new RedisDriverError(
        `Cannot increment encrypted field "${String(property)}" on entity "${this.metadata.entity.name}"`,
      );
    }
    const isFloat =
      field?.type === "decimal" || field?.type === "float" || field?.type === "real";

    const rows = await this.scanAndFilterWithSystemFilters(criteria);

    if (rows.length === 0) return;

    // F-039: Execute all eval calls in parallel instead of sequential round-trips
    const script = isFloat ? GUARDED_HINCRBYFLOAT : GUARDED_HINCRBY;
    const evalResults = await Promise.all(
      rows.map(({ key }) =>
        this.client.eval(script, 1, key, property as string, String(value)),
      ),
    );

    for (let i = 0; i < evalResults.length; i++) {
      const result = evalResults[i];
      // F-002: Lua now returns nil instead of -1 for missing keys
      if (result == null) {
        throw new RedisDriverError(
          `Increment failed: key not found for "${this.metadata.entity.name}"`,
          { debug: { redisKey: rows[i].key, property, value } },
        );
      }
    }
  }

  // ─── Decrement ────────────────────────────────────────────────────────

  public async executeDecrement(
    criteria: Predicate<E>,
    property: keyof E,
    value: number,
  ): Promise<void> {
    criteria = flattenEmbeddedCriteria(criteria, this.metadata);
    const field = this.metadata.fields.find((f) => f.key === (property as string));
    if (field?.encrypted) {
      throw new RedisDriverError(
        `Cannot decrement encrypted field "${String(property)}" on entity "${this.metadata.entity.name}"`,
      );
    }
    const isFloat =
      field?.type === "decimal" || field?.type === "float" || field?.type === "real";

    const rows = await this.scanAndFilterWithSystemFilters(criteria);

    if (rows.length === 0) return;

    // F-039: Execute all eval calls in parallel instead of sequential round-trips
    const script = isFloat ? GUARDED_HINCRBYFLOAT : GUARDED_HINCRBY;
    const evalResults = await Promise.all(
      rows.map(({ key }) =>
        this.client.eval(script, 1, key, property as string, String(-value)),
      ),
    );

    for (let i = 0; i < evalResults.length; i++) {
      const result = evalResults[i];
      // F-002: Lua now returns nil instead of -1 for missing keys
      if (result == null) {
        throw new RedisDriverError(
          `Decrement failed: key not found for "${this.metadata.entity.name}"`,
          { debug: { redisKey: rows[i].key, property, value } },
        );
      }
    }
  }

  // ─── Insert Bulk ──────────────────────────────────────────────────────

  /**
   * Insert multiple entities sequentially. This operation is NOT atomic —
   * if the Nth insert fails, the first N-1 entities remain persisted.
   * Redis has no real multi-key transactions, so partial inserts are
   * an accepted limitation.
   */
  public async executeInsertBulk(entities: Array<E>): Promise<Array<E>> {
    if (entities.length === 0) return [];

    const results: Array<E> = [];
    for (const entity of entities) {
      results.push(await this.executeInsert(entity));
    }
    return results;
  }

  // ─── Update Many ──────────────────────────────────────────────────────

  public async executeUpdateMany(
    criteria: Predicate<E>,
    update: DeepPartial<E>,
    options?: { systemFilters?: boolean },
  ): Promise<number> {
    criteria = flattenEmbeddedCriteria(criteria, this.metadata);
    const useSystemFilters = options?.systemFilters !== false;

    let keyRowPairs: Array<{ key: string; row: Dict }>;

    if (useSystemFilters) {
      keyRowPairs = await this.scanAndFilterWithSystemFilters(criteria);
    } else {
      keyRowPairs = await this.scanAndFilter(criteria);
    }

    if (keyRowPairs.length === 0) return 0;

    const pipeline = this.client.pipeline();

    for (const { key } of keyRowPairs) {
      const updateHash: Record<string, string> = {};
      for (const [fieldKey, value] of Object.entries(update as Record<string, unknown>)) {
        const field = this.metadata.fields.find((f) => f.key === fieldKey);
        if (value == null) {
          // Remove the field from the hash for null values
          pipeline.hdel(key, fieldKey);
          continue;
        }
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
        pipeline.hset(key, updateHash);
      }
    }

    // F-025: Check per-slot errors from pipeline
    const results = await this.execPipeline(pipeline);
    this.warnOnPipelineErrors(results, "executeUpdateMany");

    // F-031: Apply PEXPIREAT for each updated key if entity has an expiry field
    if (this.expiryFieldKey) {
      const expiryPipeline = this.client.pipeline();
      let hasExpiryCommands = false;

      for (const { key, row } of keyRowPairs) {
        const expiresAt = row[this.expiryFieldKey];
        // Check if the update itself changes the expiry field
        const updateEntries = update as Record<string, unknown>;
        const updatedExpiry =
          this.expiryFieldKey in updateEntries
            ? updateEntries[this.expiryFieldKey]
            : expiresAt;

        if (updatedExpiry == null) {
          expiryPipeline.persist(key);
          hasExpiryCommands = true;
        } else {
          const expiryDate = validateDate(updatedExpiry, "executeUpdateMany expiry");
          expiryPipeline.pexpireat(key, expiryDate.getTime());
          hasExpiryCommands = true;
        }
      }

      if (hasExpiryCommands) {
        const expiryResults = await this.execPipeline(expiryPipeline);
        this.warnOnPipelineErrors(expiryResults, "executeUpdateMany:expiry");
      }
    }

    return keyRowPairs.length;
  }

  // ─── Private ──────────────────────────────────────────────────────────

  /**
   * Collect field keys whose row value is null/undefined, excluding computed
   * fields and PK fields (which should never be null in an update).
   * Used to HDEL stale hash fields after HSET.
   */
  private collectNullFields(row: Dict): Array<string> {
    // F-047: Use Set for O(1) deduplication instead of Array.includes
    const nullSet = new Set<string>();
    const pkSet = new Set(this.metadata.primaryKeys);

    for (const field of this.metadata.fields) {
      if (field.computed) continue;
      if (pkSet.has(field.key)) continue;
      if (row[field.key] == null) {
        nullSet.add(field.key);
      }
    }

    // Also check FK columns from owning relations
    for (const relation of this.metadata.relations) {
      if (!relation.joinKeys) continue;
      if (relation.type === "ManyToMany") continue;

      for (const localKey of Object.keys(relation.joinKeys)) {
        if (pkSet.has(localKey)) continue;
        if (row[localKey] == null) {
          nullSet.add(localKey);
        }
      }
    }

    return Array.from(nullSet);
  }

  private hydrateFromRow(row: Dict): E {
    const effectiveMetadata = resolvePolymorphicMetadata(row, this.metadata);
    return defaultHydrateEntity<E>(row, effectiveMetadata, {
      snapshot: true,
      hooks: true,
      amphora: this.amphora,
    });
  }

  /**
   * Execute a versioned update using the VERSION_CHECK_HSET Lua script.
   * The entity manager increments version before calling update,
   * so entity.version = storedVersion + 1.
   *
   * F-013: The Lua script now atomically handles both HSET and HDEL for null
   * fields within the same script evaluation, eliminating the race window.
   */
  private async versionedUpdate(
    redisKey: string,
    hash: Record<string, string>,
    nullFields: Array<string>,
    row: Dict,
  ): Promise<void> {
    const versionKey = this.versionFieldKey!;
    const entityVersion = row[versionKey] as number;

    // Build ARGV: versionKey, entityVersion, nullCount, ...nullFields, ...hashPairs
    const args: Array<string> = [
      versionKey,
      String(entityVersion),
      String(nullFields.length),
      ...nullFields,
    ];

    // Flatten hash entries into alternating field/value pairs for HSET
    for (const [field, value] of Object.entries(hash)) {
      args.push(field, value);
    }

    const result = await this.client.eval(VERSION_CHECK_HSET, 1, redisKey, ...args);

    if (result === -1) {
      throw new RedisDriverError(
        `Update failed: no matching row found for "${this.metadata.entity.name}"`,
        { debug: { primaryKey: redisKey } },
      );
    }

    // F-003: Handle non-numeric version data
    if (result === -2) {
      throw new RedisDriverError("Version field contains non-numeric data", {
        debug: { primaryKey: redisKey, versionKey },
      });
    }

    if (result === 0) {
      throw new RedisOptimisticLockError(
        this.metadata.entity.name,
        buildPrimaryKeyDebug(row, this.metadata.primaryKeys),
      );
    }
  }

  /**
   * Execute an unversioned update using a Lua script that atomically checks
   * EXISTS before HSET. Without this guard, HSET on a missing key would
   * silently create a ghost record with only the updated fields.
   */
  private async unversionedUpdate(
    redisKey: string,
    hash: Record<string, string>,
  ): Promise<void> {
    if (Object.keys(hash).length === 0) return;

    // Flatten hash entries into alternating field/value pairs for HSET
    const args: Array<string> = [];
    for (const [field, value] of Object.entries(hash)) {
      args.push(field, value);
    }

    const result = await this.client.eval(GUARDED_HSET, 1, redisKey, ...args);

    if (result === 0) {
      throw new RedisDriverError(
        `Update failed: no matching row found for "${this.metadata.entity.name}"`,
        { debug: { primaryKey: redisKey } },
      );
    }
  }

  /**
   * Apply PEXPIREAT if the entity has an expiry field with a non-null value.
   * If the expiry value is null, persist the key (remove any existing TTL).
   */
  private async applyExpiry(redisKey: string, row: Dict): Promise<void> {
    if (!this.expiryFieldKey) return;

    const expiresAt = row[this.expiryFieldKey];

    if (expiresAt == null) {
      await this.client.persist(redisKey);
      return;
    }

    // F-026: Validate date before applying expiry
    const expiryDate = validateDate(expiresAt, "applyExpiry");
    await this.client.pexpireat(redisKey, expiryDate.getTime());
  }

  /**
   * SCAN all keys for this entity and HGETALL each to get rows.
   * F-029: Delegates to the shared scanAllRows utility.
   */
  private async doScanAllRows(): Promise<Array<Dict>> {
    const pattern = buildScanPattern(this.storageTarget, this.namespace);
    return scanAllRows(
      this.client,
      pattern,
      this.metadata.fields,
      this.metadata.relations,
      this.logger,
    );
  }

  /**
   * Resolve Redis keys matching criteria, applying PK-exact optimization where possible.
   * Returns array of Redis keys ready for pipeline operations.
   */
  private async resolveKeys(
    criteria: Predicate<E>,
    limit?: number,
  ): Promise<Array<string>> {
    const pkValues = extractExactPk(criteria, this.metadata.primaryKeys);

    if (pkValues) {
      return [buildEntityKey(this.storageTarget, pkValues, this.namespace)];
    }

    const keyRowPairs = await this.scanAndFilter(criteria);
    const keys = keyRowPairs.map((p) => p.key);

    if (limit != null) {
      return keys.slice(0, limit);
    }

    return keys;
  }

  /**
   * SCAN + filter + discriminator scope. Used by executeDelete/executeSoftDelete/executeRestore.
   * Applies the discriminator filter for single-table inheritance child entities without
   * applying soft-delete or scope filters (those operations need to reach all rows in
   * their discriminator partition regardless of soft-delete state).
   */
  private async scanAndFilterWithDiscriminator(
    criteria: Predicate<E>,
  ): Promise<Array<{ key: string; row: Dict }>> {
    const pattern = buildScanPattern(this.storageTarget, this.namespace);
    const keys = await scanEntityKeys(this.client, pattern);

    if (keys.length === 0) return [];

    const pipeline = this.client.pipeline();
    for (const key of keys) {
      pipeline.hgetall(key);
    }
    const results = await this.execPipeline(pipeline);

    const matched: Array<{ key: string; row: Dict }> = [];

    const discField = this.metadata.inheritance?.discriminatorField;
    const discValue = this.metadata.inheritance?.discriminatorValue;
    const hasDiscriminator = discField != null && discValue != null;

    for (let i = 0; i < results.length; i++) {
      const [err, hash] = results[i];
      if (err) {
        this.warnOnReadPipelineError(err, i, "scanAndFilterWithDiscriminator");
        continue;
      }

      const row = deserializeHash(
        hash as Record<string, string>,
        this.metadata.fields,
        this.metadata.relations,
      );
      if (!row) continue;

      // Skip rows outside this entity's discriminator partition
      if (hasDiscriminator && row[discField] !== discValue) continue;

      if (matchesRow(row, criteria)) {
        matched.push({ key: keys[i], row });
      }
    }

    return matched;
  }

  /**
   * SCAN all entity keys, HGETALL each, deserialize, and filter by criteria.
   * Returns matched key-row pairs for pipeline operations.
   */
  private async scanAndFilter(
    criteria: Predicate<E>,
  ): Promise<Array<{ key: string; row: Dict }>> {
    const pattern = buildScanPattern(this.storageTarget, this.namespace);
    const keys = await scanEntityKeys(this.client, pattern);

    if (keys.length === 0) return [];

    const pipeline = this.client.pipeline();
    for (const key of keys) {
      pipeline.hgetall(key);
    }
    const results = await this.execPipeline(pipeline);

    const matched: Array<{ key: string; row: Dict }> = [];

    for (let i = 0; i < results.length; i++) {
      const [err, hash] = results[i];
      if (err) {
        this.warnOnReadPipelineError(err, i, "scanAndFilter");
        continue;
      }

      const row = deserializeHash(
        hash as Record<string, string>,
        this.metadata.fields,
        this.metadata.relations,
      );
      if (!row) continue;

      if (matchesRow(row, criteria)) {
        matched.push({ key: keys[i], row });
      }
    }

    return matched;
  }

  /**
   * SCAN + filter + system filters. Used by increment/decrement/updateMany.
   * F-037: Filter ordering standardized to: version → system → criteria.
   */
  private async scanAndFilterWithSystemFilters(
    criteria: Predicate<E>,
  ): Promise<Array<{ key: string; row: Dict }>> {
    const pattern = buildScanPattern(this.storageTarget, this.namespace);
    const keys = await scanEntityKeys(this.client, pattern);

    if (keys.length === 0) return [];

    const pipeline = this.client.pipeline();
    for (const key of keys) {
      pipeline.hgetall(key);
    }
    const results = await this.execPipeline(pipeline);

    let rows: Array<{ key: string; row: Dict }> = [];

    for (let i = 0; i < results.length; i++) {
      const [err, hash] = results[i];
      if (err) {
        this.warnOnReadPipelineError(err, i, "scanAndFilterWithSystemFilters");
        continue;
      }

      const row = deserializeHash(
        hash as Record<string, string>,
        this.metadata.fields,
        this.metadata.relations,
      );
      if (!row) continue;

      rows.push({ key: keys[i], row });
    }

    // F-037: 1. Apply version system filter first
    const versionEndField = this.metadata.fields.find(
      (f) => f.decorator === "VersionEndDate",
    );
    if (versionEndField) {
      rows = rows.filter((r) => r.row[versionEndField.key] == null);
    }

    // F-037: 2. Apply system filters (soft-delete, scope)
    const sysMetaFilters = this.metadata.filters?.length
      ? this.metadata.filters
      : generateAutoFilters(this.metadata.fields);
    const resolved = resolveFilters(sysMetaFilters, this.filterRegistry, undefined);

    // F-010: Index-based filtering instead of Set-based object identity check
    if (resolved.length > 0) {
      const survivingIndices = new Set<number>();
      let candidateRows = rows.map((r) => r.row);
      candidateRows = applyResolvedFilters(candidateRows, resolved);

      // Build a set of surviving row indices by matching object identity
      // against the original rows array. Since applyResolvedFilters returns
      // a subset of the input array elements (same references), we can
      // use a WeakSet for O(1) membership checks.
      const survivingRowRefs = new WeakSet(candidateRows.map((r) => r as object));
      for (let i = 0; i < rows.length; i++) {
        if (survivingRowRefs.has(rows[i].row as object)) {
          survivingIndices.add(i);
        }
      }
      rows = rows.filter((_, idx) => survivingIndices.has(idx));
    }

    // F-037: 3. Apply criteria match last
    if (Object.keys(criteria).length > 0) {
      rows = rows.filter((r) => matchesRow(r.row, criteria));
    }

    return rows;
  }

  /**
   * Apply version system filter based on FindOptions.
   */
  private applyVersionFilter(rows: Array<Dict>, options: FindOptions<E>): Array<Dict> {
    const versionEndField = this.metadata.fields.find(
      (f) => f.decorator === "VersionEndDate",
    );
    if (!versionEndField) return rows;

    if (options.versionTimestamp) {
      const ts = options.versionTimestamp.getTime();
      const versionStartField = this.metadata.fields.find(
        (f) => f.decorator === "VersionStartDate",
      );
      return rows.filter((r) => {
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

    if (!options.withAllVersions) {
      return rows.filter((r) => r[versionEndField.key] == null);
    }

    return rows;
  }

  /**
   * Execute a pipeline and check for global errors.
   */
  private async execPipeline(
    pipeline: ReturnType<Redis["pipeline"]>,
  ): Promise<Array<[Error | null, any]>> {
    const results = await pipeline.exec();

    if (!results) {
      throw new RedisDriverError("Pipeline execution returned null");
    }

    return results;
  }

  /**
   * F-025: Log warnings for per-slot errors in pipeline results.
   * Pipeline operations can succeed globally but fail on individual commands
   * (e.g., type mismatch, OOM on a single slot). These errors are otherwise
   * silently ignored.
   */
  private warnOnPipelineErrors(
    results: Array<[Error | null, any]>,
    operation: string,
  ): void {
    for (let i = 0; i < results.length; i++) {
      const [err] = results[i];
      if (err) {
        this.warnOnReadPipelineError(err, i, operation);
      }
    }
  }

  /**
   * Log a warning for a single per-slot pipeline error during read operations.
   * Read-path pipelines previously silently dropped errors with `if (err) continue`,
   * making per-slot failures invisible. This provides observability into pipeline
   * command failures without changing control flow.
   */
  private warnOnReadPipelineError(
    err: Error,
    slotIndex: number,
    operation: string,
  ): void {
    if (this.logger) {
      this.logger.warn(`Pipeline slot error in ${operation}`, {
        slotIndex,
        error: err.message,
        entityName: this.metadata.entity.name,
      });
    }
  }
}
