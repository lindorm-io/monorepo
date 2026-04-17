import type { ILogger } from "@lindorm/logger";
import type { DeepPartial, Predicate } from "@lindorm/types";
import type { ICacheAdapter } from "../../interfaces/CacheAdapter";
import type {
  IEntity,
  IProteusCursor,
  IProteusQueryBuilder,
  IProteusRepository,
} from "../../interfaces";
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
} from "../../types";
import type { EntityMetadata, QueryScope } from "../entity/types/metadata";
import { ProteusRepositoryError } from "../../errors/ProteusRepositoryError";
import { buildCacheKey, buildCachePrefix } from "../utils/cache/build-cache-key";
import { resolveCacheTtl } from "../utils/cache/resolve-cache-ttl";
import { defaultHydrateEntity } from "../entity/utils/default-hydrate-entity";
import { resolvePolymorphicMetadata } from "../entity/utils/resolve-polymorphic-metadata";
import { runHooksAsync } from "../entity/utils/run-hooks-async";

// ─── JSON replacer / reviver ─────────────────────────────────────────────

const jsonReplacer = (_key: string, value: unknown): unknown => {
  if (typeof value === "bigint") return { __t: "bigint", v: String(value) };
  return value;
};

const jsonReviver = (_key: string, value: unknown): unknown => {
  if (value !== null && typeof value === "object" && (value as any).__t === "bigint") {
    return BigInt((value as any).v);
  }
  return value;
};

// ─── Options ─────────────────────────────────────────────────────────────

export type CachingRepositoryOptions<E extends IEntity> = {
  inner: IProteusRepository<E>;
  adapter: ICacheAdapter;
  metadata: EntityMetadata;
  namespace: string | null;
  sourceTtlMs: number | undefined;
  logger: ILogger;
};

// ─── CachingRepository ──────────────────────────────────────────────────

export class CachingRepository<
  E extends IEntity,
  O = DeepPartial<E>,
> implements IProteusRepository<E, O> {
  private readonly inner: IProteusRepository<E, O>;
  private readonly adapter: ICacheAdapter;
  private readonly metadata: EntityMetadata;
  private readonly namespace: string | null;
  private readonly entityName: string;
  private readonly sourceTtlMs: number | undefined;
  private readonly logger: ILogger;
  private readonly hasBinaryFields: boolean;
  private readonly hasEncryptedFields: boolean;
  private readonly hasEagerRelations: boolean;
  private readonly hasLazyRelations: boolean;
  private readonly inflight = new Map<string, Promise<unknown>>();

  public constructor(options: CachingRepositoryOptions<E>) {
    this.inner = options.inner as IProteusRepository<E, O>;
    this.adapter = options.adapter;
    this.metadata = options.metadata;
    this.namespace = options.namespace;
    this.entityName = options.metadata.entity.name;
    this.sourceTtlMs = options.sourceTtlMs;
    this.logger = options.logger.child([
      "CachingRepository",
      options.metadata.entity.name,
    ]);
    this.hasBinaryFields = options.metadata.fields.some((f) => f.type === "binary");
    this.hasEncryptedFields = options.metadata.fields.some((f) => !!f.encrypted);
    this.hasEagerRelations = options.metadata.relations.some(
      (r) =>
        r.options.loading.single === "eager" || r.options.loading.multiple === "eager",
    );
    this.hasLazyRelations = options.metadata.relations.some(
      (r) => r.options.loading.single === "lazy" || r.options.loading.multiple === "lazy",
    );
  }

  // ─── Category C: Passthrough (no caching) ───────────────────────────

  public create(options?: O | E): E {
    return this.inner.create(options);
  }

  public copy(entity: E): E {
    return this.inner.copy(entity);
  }

  public validate(entity: E): void {
    this.inner.validate(entity);
  }

  public async ttl(criteria: Predicate<E>, options?: FindOptions<E>): Promise<number> {
    return this.inner.ttl(criteria, options);
  }

  public async cursor(options?: CursorOptions<E>): Promise<IProteusCursor<E>> {
    return this.inner.cursor(options);
  }

  public stream(options?: CursorOptions<E>): AsyncIterable<E> {
    return this.inner.stream(options);
  }

  public async paginate(
    criteria?: Predicate<E>,
    options?: PaginateOptions<E>,
  ): Promise<PaginateResult<E>> {
    return this.inner.paginate(criteria, options);
  }

  public async versions(
    criteria: Predicate<E>,
    options?: FindOptions<E>,
  ): Promise<Array<E>> {
    return this.inner.versions(criteria, options);
  }

  public async sum(field: keyof E, criteria?: Predicate<E>): Promise<number | null> {
    return this.inner.sum(field, criteria);
  }

  public async average(field: keyof E, criteria?: Predicate<E>): Promise<number | null> {
    return this.inner.average(field, criteria);
  }

  public async minimum(field: keyof E, criteria?: Predicate<E>): Promise<number | null> {
    return this.inner.minimum(field, criteria);
  }

  public async maximum(field: keyof E, criteria?: Predicate<E>): Promise<number | null> {
    return this.inner.maximum(field, criteria);
  }

  /**
   * Returns the inner query builder directly. INSERT/UPDATE/DELETE statements
   * executed through the query builder bypass cache invalidation. Call
   * find/findOne after QB writes to get fresh data, or use the repository's
   * write methods (insert, update, save, etc.) which handle invalidation.
   */
  public queryBuilder(): IProteusQueryBuilder<E> {
    return this.inner.queryBuilder();
  }

  public async setup(): Promise<void> {
    return this.inner.setup();
  }

  // ─── Category A: Cache-aside reads ──────────────────────────────────

  public async find(
    criteria?: Predicate<E>,
    options?: FindOptions<E>,
  ): Promise<Array<E>> {
    return this.cachedEntities("find", criteria, options, () =>
      this.inner.find(criteria, options),
    );
  }

  public async findOne(
    criteria: Predicate<E>,
    options?: FindOptions<E>,
  ): Promise<E | null> {
    const results = await this.cachedEntities(
      "findOne",
      criteria,
      options,
      () => this.inner.findOne(criteria, options).then((e) => (e ? [e] : [])),
      ["single"],
    );
    return results[0] ?? null;
  }

  public async findOneOrFail(
    criteria: Predicate<E>,
    options?: FindOptions<E>,
  ): Promise<E> {
    const entity = await this.findOne(criteria, options);
    if (!entity) {
      throw new ProteusRepositoryError(`Entity "${this.entityName}" not found`, {
        debug: { criteria },
      });
    }
    return entity;
  }

  public async findAndCount(
    criteria?: Predicate<E>,
    options?: FindOptions<E>,
  ): Promise<[Array<E>, number]> {
    return this.cachedTuple("findAndCount", criteria, options, () =>
      this.inner.findAndCount(criteria, options),
    );
  }

  public async count(criteria?: Predicate<E>, options?: FindOptions<E>): Promise<number> {
    return this.cachedScalar("count", criteria, options, () =>
      this.inner.count(criteria, options),
    );
  }

  public async exists(
    criteria: Predicate<E>,
    options?: FindOptions<E>,
  ): Promise<boolean> {
    return this.cachedScalar("exists", criteria, options, () =>
      this.inner.exists(criteria, options),
    );
  }

  public async findPaginated(
    criteria?: Predicate<E>,
    options?: FindPaginatedOptions<E>,
  ): Promise<FindPaginatedResult<E>> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 10;

    if (page < 1) {
      throw new ProteusRepositoryError("findPaginated: page must be >= 1");
    }
    if (pageSize < 1) {
      throw new ProteusRepositoryError("findPaginated: pageSize must be >= 1");
    }

    const offset = (page - 1) * pageSize;
    const { page: _p, pageSize: _ps, ...rest } = options ?? {};

    const [data, total] = await this.findAndCount(criteria, {
      ...rest,
      limit: pageSize,
      offset,
    });

    const totalPages = Math.ceil(total / pageSize);
    const hasMore = page * pageSize < total;

    return { data, total, page, pageSize, totalPages, hasMore };
  }

  public async findOneOrSave(
    criteria: Predicate<E>,
    entity: O | E,
    options?: FindOptions<E>,
  ): Promise<E> {
    const existing = await this.findOne(criteria, options);
    if (existing) return existing;
    return this.save(entity);
  }

  // ─── Category B: Write + invalidate ─────────────────────────────────

  public insert(entity: O | E): Promise<E>;
  public insert(entities: Array<O | E>): Promise<Array<E>>;
  public async insert(input: O | E | Array<O | E>): Promise<E | Array<E>> {
    const result = await (this.inner.insert as any)(input);
    await this.invalidate();
    return result;
  }

  public save(entity: O | E): Promise<E>;
  public save(entities: Array<O | E>): Promise<Array<E>>;
  public async save(input: O | E | Array<O | E>): Promise<E | Array<E>> {
    const result = await (this.inner.save as any)(input);
    await this.invalidate();
    return result;
  }

  public update(entity: E): Promise<E>;
  public update(entities: Array<E>): Promise<Array<E>>;
  public async update(input: E | Array<E>): Promise<E | Array<E>> {
    const result = await (this.inner.update as any)(input);
    await this.invalidate();
    return result;
  }

  public clone(entity: E): Promise<E>;
  public clone(entities: Array<E>): Promise<Array<E>>;
  public async clone(input: E | Array<E>): Promise<E | Array<E>> {
    const result = await (this.inner.clone as any)(input);
    await this.invalidate();
    return result;
  }

  public destroy(entity: E): Promise<void>;
  public destroy(entities: Array<E>): Promise<void>;
  public async destroy(input: E | Array<E>): Promise<void> {
    await (this.inner.destroy as any)(input);
    await this.invalidate();
  }

  public softDestroy(entity: E): Promise<void>;
  public softDestroy(entities: Array<E>): Promise<void>;
  public async softDestroy(input: E | Array<E>): Promise<void> {
    await (this.inner.softDestroy as any)(input);
    await this.invalidate();
  }

  public upsert(entity: E, options?: UpsertOptions<E>): Promise<E>;
  public upsert(entities: Array<E>, options?: UpsertOptions<E>): Promise<Array<E>>;
  public async upsert(
    input: E | Array<E>,
    options?: UpsertOptions<E>,
  ): Promise<E | Array<E>> {
    const result = await (this.inner.upsert as any)(input, options);
    await this.invalidate();
    return result;
  }

  public async delete(criteria: Predicate<E>, options?: DeleteOptions): Promise<void> {
    await this.inner.delete(criteria, options);
    await this.invalidate();
  }

  public async softDelete(
    criteria: Predicate<E>,
    options?: DeleteOptions,
  ): Promise<void> {
    await this.inner.softDelete(criteria, options);
    await this.invalidate();
  }

  public async restore(criteria: Predicate<E>, options?: DeleteOptions): Promise<void> {
    await this.inner.restore(criteria, options);
    await this.invalidate();
  }

  public async updateMany(criteria: Predicate<E>, update: DeepPartial<E>): Promise<void> {
    await this.inner.updateMany(criteria, update);
    await this.invalidate();
  }

  public async increment(
    criteria: Predicate<E>,
    property: keyof E,
    value: number,
  ): Promise<void> {
    await this.inner.increment(criteria, property, value);
    await this.invalidate();
  }

  public async decrement(
    criteria: Predicate<E>,
    property: keyof E,
    value: number,
  ): Promise<void> {
    await this.inner.decrement(criteria, property, value);
    await this.invalidate();
  }

  public async deleteExpired(): Promise<void> {
    await this.inner.deleteExpired();
    await this.invalidate();
  }

  public async clear(options?: ClearOptions): Promise<void> {
    await this.inner.clear(options);
    await this.invalidate();
  }

  // ─── Private: Cache-aside helpers ───────────────────────────────────

  private shouldSkipCache(options?: FindOptions<E>): boolean {
    if (this.hasBinaryFields) return true;
    if (this.hasEncryptedFields) return true;
    if (this.hasEagerRelations) return true;
    if (this.hasLazyRelations) return true;
    if (options?.relations?.length) {
      this.logger.debug("Cache skipped: relations requested", {
        entityName: this.entityName,
      });
      return true;
    }
    if (options?.lock) return true;
    return false;
  }

  private async cachedEntities(
    operation: string,
    criteria: Predicate<E> | undefined,
    options: FindOptions<E> | undefined,
    fetchFn: () => Promise<Array<E>>,
    scopes: Array<QueryScope> = ["multiple"],
  ): Promise<Array<E>> {
    const ttlResult = resolveCacheTtl({
      findCacheOption: options?.cache,
      metaCache: this.metadata.cache,
      sourceTtlMs: this.sourceTtlMs,
    });

    if (!ttlResult.enabled) return fetchFn();
    if (this.shouldSkipCache(options)) return fetchFn();

    const key = this.buildKey(operation, criteria, options);

    try {
      const cached = await this.adapter.get(key);
      if (cached != null) {
        this.logger.debug("Cache hit", { key });
        return this.deserializeEntities(JSON.parse(cached, jsonReviver), scopes);
      }
    } catch (err) {
      this.logger.warn("Cache get failed", { error: err, key });
    }

    if (this.inflight.has(key)) {
      return this.inflight.get(key) as Promise<Array<E>>;
    }

    const promise = fetchFn().then(async (result) => {
      try {
        const serialized = JSON.stringify(this.serializeEntities(result), jsonReplacer);
        await this.adapter.set(key, serialized, ttlResult.ttlMs);
      } catch (err) {
        this.logger.warn("Cache set failed", { error: err, key });
      }
      return result;
    });

    this.inflight.set(key, promise);
    void promise.finally(() => this.inflight.delete(key));

    return promise;
  }

  private async cachedTuple(
    operation: string,
    criteria: Predicate<E> | undefined,
    options: FindOptions<E> | undefined,
    fetchFn: () => Promise<[Array<E>, number]>,
    scopes: Array<QueryScope> = ["multiple"],
  ): Promise<[Array<E>, number]> {
    const ttlResult = resolveCacheTtl({
      findCacheOption: options?.cache,
      metaCache: this.metadata.cache,
      sourceTtlMs: this.sourceTtlMs,
    });

    if (!ttlResult.enabled) return fetchFn();
    if (this.shouldSkipCache(options)) return fetchFn();

    const key = this.buildKey(operation, criteria, options);

    try {
      const cached = await this.adapter.get(key);
      if (cached != null) {
        this.logger.debug("Cache hit", { key });
        const parsed = JSON.parse(cached, jsonReviver) as {
          entities: Array<Record<string, unknown>>;
          count: number;
        };
        const entities = await this.deserializeEntities(parsed.entities, scopes);
        return [entities, parsed.count];
      }
    } catch (err) {
      this.logger.warn("Cache get failed", { error: err, key });
    }

    if (this.inflight.has(key)) {
      return this.inflight.get(key) as Promise<[Array<E>, number]>;
    }

    const promise = fetchFn().then(async ([entities, count]) => {
      try {
        const payload = { entities: this.serializeEntities(entities), count };
        await this.adapter.set(
          key,
          JSON.stringify(payload, jsonReplacer),
          ttlResult.ttlMs,
        );
      } catch (err) {
        this.logger.warn("Cache set failed", { error: err, key });
      }
      return [entities, count] as [Array<E>, number];
    });

    this.inflight.set(key, promise);
    void promise.finally(() => this.inflight.delete(key));

    return promise;
  }

  private async cachedScalar<T extends number | boolean>(
    operation: string,
    criteria: Predicate<E> | undefined,
    options: FindOptions<E> | undefined,
    fetchFn: () => Promise<T>,
  ): Promise<T> {
    const ttlResult = resolveCacheTtl({
      findCacheOption: options?.cache,
      metaCache: this.metadata.cache,
      sourceTtlMs: this.sourceTtlMs,
    });

    if (!ttlResult.enabled) return fetchFn();
    if (this.shouldSkipCache(options)) return fetchFn();

    const key = this.buildKey(operation, criteria, options);

    try {
      const cached = await this.adapter.get(key);
      if (cached != null) {
        this.logger.debug("Cache hit", { key });
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      this.logger.warn("Cache get failed", { error: err, key });
    }

    if (this.inflight.has(key)) {
      return this.inflight.get(key) as Promise<T>;
    }

    const promise = fetchFn().then(async (result) => {
      try {
        await this.adapter.set(key, JSON.stringify(result), ttlResult.ttlMs);
      } catch (err) {
        this.logger.warn("Cache set failed", { error: err, key });
      }
      return result;
    });

    this.inflight.set(key, promise);
    void promise.finally(() => this.inflight.delete(key));

    return promise;
  }

  // ─── Private: Serialization ─────────────────────────────────────────

  private serializeEntities(entities: Array<E>): Array<Record<string, unknown>> {
    return entities.map((entity) => {
      const entityDict = entity as Record<string, unknown>;
      const effectiveMetadata = resolvePolymorphicMetadata(entityDict, this.metadata);

      const data: Record<string, unknown> = {};
      for (const field of effectiveMetadata.fields) {
        // Store entity-side values directly — defaultHydrateEntity handles
        // deserialise() + transform.from() on the replay path.
        data[field.key] = (entity as any)[field.key];
      }
      // Serialize FK join-key columns from owning relations
      for (const relation of effectiveMetadata.relations) {
        if (!relation.joinKeys || relation.type === "ManyToMany") continue;
        for (const localKey of Object.keys(relation.joinKeys)) {
          if (!(localKey in data)) {
            data[localKey] = (entity as any)[localKey] ?? null;
          }
        }
      }
      return data;
    });
  }

  private async deserializeEntities(
    items: Array<Record<string, unknown>>,
    scopes: Array<QueryScope>,
  ): Promise<Array<E>> {
    const entities: Array<E> = [];
    for (const data of items) {
      const effectiveMetadata = resolvePolymorphicMetadata(data, this.metadata);

      const entity = defaultHydrateEntity<E>(data as any, effectiveMetadata, {
        snapshot: true,
        hooks: true,
      });
      await runHooksAsync("AfterLoad", effectiveMetadata.hooks, entity, undefined);

      const hiddenKeys = effectiveMetadata.fields
        .filter((f) => scopes.some((s) => f.hideOn.includes(s)))
        .map((f) => f.key);

      for (const key of hiddenKeys) {
        delete (entity as any)[key];
      }

      entities.push(entity);
    }
    return entities;
  }

  // ─── Private: Key building ──────────────────────────────────────────

  private buildKey(
    operation: string,
    criteria: Predicate<E> | undefined,
    options: FindOptions<E> | undefined,
  ): string {
    return buildCacheKey({
      namespace: this.namespace,
      entityName: this.entityName,
      operation,
      criteria,
      options: options as Record<string, unknown>,
    });
  }

  // ─── Private: Invalidation ─────────────────────────────────────────

  /**
   * Nuclear invalidation: evicts ALL cached queries for this entity type.
   * Any write operation triggers this. This is intentional — fine-grained
   * per-query invalidation requires tracking which queries overlap with
   * mutated rows (research-level complexity). Short TTLs are the mitigation
   * for high-write workloads.
   */
  private async invalidate(): Promise<void> {
    try {
      await this.adapter.delByPrefix(buildCachePrefix(this.namespace, this.entityName));
    } catch (err) {
      this.logger.warn("Cache invalidation failed", { error: err });
    }
  }
}
