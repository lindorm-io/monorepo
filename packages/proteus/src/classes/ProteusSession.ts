import type { ILogger } from "@lindorm/logger";
import type { Constructor, Dict } from "@lindorm/types";
import type {
  IEntity,
  IProteusQueryBuilder,
  IProteusRepository,
  IProteusSession,
  IProteusSource,
} from "../interfaces/index.js";
import type { ICacheAdapter } from "../interfaces/CacheAdapter.js";
import type {
  EntityEmitFn,
  TransactionCallback,
  TransactionOptions,
} from "../types/index.js";
import { CachingRepository } from "../internal/classes/CachingRepository.js";
import type { MetadataResolver } from "../internal/interfaces/ProteusDriver.js";
import type { IProteusDriver } from "../internal/interfaces/ProteusDriver.js";
import type { FilterRegistry } from "../internal/utils/query/filter-registry.js";
import {
  setFilterParams as setFilterParamsUtil,
  enableFilter as enableFilterUtil,
  disableFilter as disableFilterUtil,
} from "../internal/utils/query/filter-registry.js";

export type ProteusSessionOptions<C = unknown> = {
  source: IProteusSource<C>;
  logger: ILogger;
  context: C;
  driver: IProteusDriver;
  registryRef: { current: FilterRegistry };
  resolveMetadata: MetadataResolver;
  cacheAdapter: ICacheAdapter | undefined;
  sourceTtlMs: number | undefined;
  parentEmitEntity: EntityEmitFn;
};

/**
 * Lightweight, request-scoped session derived from a ProteusSource.
 *
 * Shares the parent's connection pool and entity metadata but carries its own
 * logger, context, and filter registry. Entity lifecycle events bubble up to
 * the parent source's EventEmitter.
 *
 * Sessions are ephemeral data-access handles — they expose no lifecycle,
 * event-subscription, or configuration methods.
 */
export class ProteusSession<C = unknown> implements IProteusSession<C> {
  private readonly source: IProteusSource<C>;
  private readonly logger: ILogger;
  private readonly context: C;
  private readonly _driver: IProteusDriver;
  private _registryRef: { current: FilterRegistry };
  private readonly resolveMetadata: MetadataResolver;
  private readonly cacheAdapter: ICacheAdapter | undefined;
  private readonly sourceTtlMs: number | undefined;
  private readonly parentEmitEntity: EntityEmitFn;

  public constructor(options: ProteusSessionOptions<C>) {
    this.source = options.source;
    this._driver = options.driver;
    this.logger = options.logger;
    this.context = options.context;
    this._registryRef = options.registryRef;
    this.resolveMetadata = options.resolveMetadata;
    this.cacheAdapter = options.cacheAdapter;
    this.sourceTtlMs = options.sourceTtlMs;
    this.parentEmitEntity = options.parentEmitEntity;
  }

  // ─── Getters (delegated to source for immutable properties) ─────────

  public get namespace(): string | null {
    return this.source.namespace;
  }

  public get driverType(): string {
    return this.source.driverType;
  }

  public get log(): ILogger {
    return this.logger;
  }

  // ─── Data-access methods ────────────────────────────────────────────

  public hasEntity<E extends IEntity>(target: Constructor<E>): boolean {
    return this.source.hasEntity(target);
  }

  public repository<E extends IEntity>(target: Constructor<E>): IProteusRepository<E> {
    const inner = this._driver.createRepository(target, undefined, this.context);
    if (!this.cacheAdapter) return inner;

    const metadata = this.resolveMetadata(target);
    return new CachingRepository<E>({
      inner,
      adapter: this.cacheAdapter,
      metadata,
      namespace: this.source.namespace,
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
   * Returns the emit function for this session. Used when creating
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
}
