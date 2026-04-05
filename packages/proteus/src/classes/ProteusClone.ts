import type { ICircuitBreaker } from "@lindorm/breaker";
import type { ILogger } from "@lindorm/logger";
import type { Constructor, Dict } from "@lindorm/types";
import { NotSupportedError } from "../errors";
import type {
  IEntity,
  IProteusQueryBuilder,
  IProteusRepository,
  IProteusSource,
} from "../interfaces";
import type { ICacheAdapter } from "../interfaces/CacheAdapter";
import type {
  EntityEmitFn,
  EntityScannerInput,
  ProteusSourceEventMap,
  TransactionCallback,
  TransactionOptions,
} from "../types";
import type { CloneOptions } from "./ProteusSource";
import { CachingRepository } from "#internal/classes/CachingRepository";
import type { MetaInheritance } from "#internal/entity/types/inheritance";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import type {
  IProteusDriver,
  MetadataResolver,
} from "#internal/interfaces/ProteusDriver";
import type { FilterRegistry } from "#internal/utils/query/filter-registry";
import {
  setFilterParams as setFilterParamsUtil,
  enableFilter as enableFilterUtil,
  disableFilter as disableFilterUtil,
} from "#internal/utils/query/filter-registry";

export type ProteusCloneOptions<C = unknown> = {
  logger: ILogger;
  context: C;
  driver: IProteusDriver;
  namespace: string | null;
  driverType: string;
  registryRef: { current: FilterRegistry };
  resolveMetadata: MetadataResolver;
  entities: Array<Constructor<IEntity>>;
  inheritanceMap: Map<Function, MetaInheritance> | undefined;
  namingCache: Map<Function, EntityMetadata> | null;
  cacheAdapter: ICacheAdapter | undefined;
  sourceTtlMs: number | undefined;
  parentEmitEntity: EntityEmitFn;
};

/**
 * Lightweight, request-scoped clone of a ProteusSource.
 *
 * Shares the parent's connection pool and entity metadata but carries its own
 * logger, context, and filter registry. Entity lifecycle events bubble up to
 * the parent source's EventEmitter.
 *
 * Lifecycle, event-subscription, and configuration methods throw
 * NotSupportedError — clones are ephemeral data-access handles.
 */
export class ProteusClone<C = unknown> implements IProteusSource<C> {
  private readonly _driver: IProteusDriver;
  private readonly logger: ILogger;
  private readonly context: C;
  private readonly _namespace: string | null;
  private readonly _driverType: string;
  private _registryRef: { current: FilterRegistry };
  private readonly resolveMetadata: MetadataResolver;
  private readonly _entities: Array<Constructor<IEntity>>;
  private readonly _inheritanceMap: Map<Function, MetaInheritance> | undefined;
  private readonly _namingCache: Map<Function, EntityMetadata> | null;
  private readonly cacheAdapter: ICacheAdapter | undefined;
  private readonly sourceTtlMs: number | undefined;
  private readonly parentEmitEntity: EntityEmitFn;

  public constructor(options: ProteusCloneOptions<C>) {
    this._driver = options.driver;
    this.logger = options.logger;
    this.context = options.context;
    this._namespace = options.namespace;
    this._driverType = options.driverType;
    this._registryRef = options.registryRef;
    this.resolveMetadata = options.resolveMetadata;
    this._entities = options.entities;
    this._inheritanceMap = options.inheritanceMap;
    this._namingCache = options.namingCache;
    this.cacheAdapter = options.cacheAdapter;
    this.sourceTtlMs = options.sourceTtlMs;
    this.parentEmitEntity = options.parentEmitEntity;
  }

  // ─── Data-access getters ────────────────────────────────────────────

  public get namespace(): string | null {
    return this._namespace;
  }

  public get driverType(): string {
    return this._driverType;
  }

  public get log(): ILogger {
    return this.logger;
  }

  // ─── Lifecycle stubs (throw) ────────────────────────────────────────

  public get migrationsTable(): string | undefined {
    return undefined;
  }

  public get breaker(): ICircuitBreaker | null {
    return null;
  }

  // ─── Data-access methods ────────────────────────────────────────────

  public repository<E extends IEntity>(target: Constructor<E>): IProteusRepository<E> {
    const inner = this._driver.createRepository(target, undefined, this.context);
    if (!this.cacheAdapter) return inner;

    const metadata = this.resolveMetadata(target);
    return new CachingRepository<E>({
      inner,
      adapter: this.cacheAdapter,
      metadata,
      namespace: this._namespace,
      sourceTtlMs: this.sourceTtlMs,
      logger: this.logger,
    });
  }

  public queryBuilder<E extends IEntity>(
    target: Constructor<E>,
  ): IProteusQueryBuilder<E> {
    return this._driver.createQueryBuilder(target);
  }

  public async client<T>(): Promise<T> {
    return this._driver.acquireClient() as Promise<T>;
  }

  public async transaction<T>(
    callback: TransactionCallback<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    return this._driver.withTransaction(callback, options);
  }

  public async ping(): Promise<boolean> {
    return this._driver.ping();
  }

  // ─── Filter methods ─────────────────────────────────────────────────

  public setFilterParams(name: string, params: Dict<unknown>): void {
    setFilterParamsUtil(this._registryRef.current, name, params);
  }

  public enableFilter(name: string): void {
    enableFilterUtil(this._registryRef.current, name);
  }

  public disableFilter(name: string): void {
    disableFilterUtil(this._registryRef.current, name);
  }

  public getFilterRegistry(): FilterRegistry {
    return this._registryRef.current;
  }

  // ─── Event bubbling ─────────────────────────────────────────────────

  /**
   * Returns the emit function for this clone. Used when creating
   * the cloned driver so entity events bubble to the parent source.
   */
  public getEmitEntity(): EntityEmitFn {
    return this.emitEntity;
  }

  private readonly emitEntity: EntityEmitFn = async (
    event: string,
    payload: unknown,
  ): Promise<void> => {
    await this.parentEmitEntity(event, payload);
  };

  // ─── Unsupported operations (throw) ─────────────────────────────────

  public async setup(): Promise<void> {
    throw new NotSupportedError("Cannot call setup() on a cloned ProteusSource");
  }

  public async connect(): Promise<void> {
    throw new NotSupportedError("Cannot call connect() on a cloned ProteusSource");
  }

  public async disconnect(): Promise<void> {
    throw new NotSupportedError("Cannot call disconnect() on a cloned ProteusSource");
  }

  public on<K extends keyof ProteusSourceEventMap<C>>(
    _event: K,
    _listener: (payload: ProteusSourceEventMap<C>[K]) => void,
  ): void {
    throw new NotSupportedError("Cannot register listeners on a cloned ProteusSource");
  }

  public off<K extends keyof ProteusSourceEventMap<C>>(
    _event: K,
    _listener: (payload: ProteusSourceEventMap<C>[K]) => void,
  ): void {
    throw new NotSupportedError("Cannot register listeners on a cloned ProteusSource");
  }

  public once<K extends keyof ProteusSourceEventMap<C>>(
    _event: K,
    _listener: (payload: ProteusSourceEventMap<C>[K]) => void,
  ): void {
    throw new NotSupportedError("Cannot register listeners on a cloned ProteusSource");
  }

  public clone(_options?: CloneOptions<C>): IProteusSource<C> {
    throw new NotSupportedError("Cannot clone a cloned ProteusSource");
  }

  public addEntities(_entities: EntityScannerInput): void {
    throw new NotSupportedError("Cannot add entities to a cloned ProteusSource");
  }

  public getEntityMetadata(): Array<EntityMetadata> {
    throw new NotSupportedError("Cannot get entity metadata from a cloned ProteusSource");
  }
}
