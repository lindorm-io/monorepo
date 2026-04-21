import type { Constructor } from "@lindorm/types";
import type {
  EntityEmitFn,
  TransactionCallback,
  TransactionOptions,
} from "../../types/index.js";
import type { EntityMetadata } from "../entity/types/metadata.js";
import type { FilterRegistry } from "../utils/query/filter-registry.js";
import type { IEntity } from "../../interfaces/Entity.js";
import type { IProteusQueryBuilder } from "../../interfaces/ProteusQueryBuilder.js";
import type { IProteusRepository } from "../../interfaces/ProteusRepository.js";
import type { IRepositoryExecutor } from "./RepositoryExecutor.js";

export type MetadataResolver = (target: Constructor<IEntity>) => EntityMetadata;

/**
 * Getter function for the filter registry.
 * Drivers call this at query time to get the current filter state.
 * This indirection ensures clone() can swap the registry without
 * re-creating the driver.
 */
export type FilterRegistryGetter = () => FilterRegistry;

export type TransactionHandle = unknown;

export interface IProteusDriver {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ping(): Promise<boolean>;
  setup(entities: Array<Constructor<IEntity>>): Promise<void>;

  createRepository<E extends IEntity>(
    target: Constructor<E>,
    parent?: Constructor<IEntity>,
    context?: unknown,
  ): IProteusRepository<E>;

  createExecutor<E extends IEntity>(target: Constructor<E>): IRepositoryExecutor<E>;
  createTransactionalExecutor<E extends IEntity>(
    target: Constructor<E>,
    handle: TransactionHandle,
  ): IRepositoryExecutor<E>;

  createQueryBuilder<E extends IEntity>(target: Constructor<E>): IProteusQueryBuilder<E>;
  createTransactionalQueryBuilder<E extends IEntity>(
    target: Constructor<E>,
    handle: TransactionHandle,
  ): IProteusQueryBuilder<E>;

  acquireClient(): Promise<unknown>;

  beginTransaction(options?: TransactionOptions): Promise<TransactionHandle>;
  commitTransaction(handle: TransactionHandle): Promise<void>;
  rollbackTransaction(handle: TransactionHandle): Promise<void>;
  withTransaction<T>(
    callback: TransactionCallback<T>,
    options?: TransactionOptions,
  ): Promise<T>;

  /**
   * Create a lightweight clone of this driver that shares the same
   * connection resources (pool, store) but uses different filter/emitEntity
   * functions. Used by ProteusSource.session() to achieve per-request isolation.
   */
  cloneWithGetters(
    getFilterRegistry: FilterRegistryGetter,
    emitEntity: EntityEmitFn,
  ): IProteusDriver;
}
