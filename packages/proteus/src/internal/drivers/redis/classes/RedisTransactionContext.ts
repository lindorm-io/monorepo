import type { Constructor } from "@lindorm/types";
import type {
  IEntity,
  IProteusQueryBuilder,
  IProteusRepository,
  ITransactionContext,
} from "../../../../interfaces/index.js";
import type { RepositoryFactory } from "../../../types/repository-factory.js";
import type { RedisTransactionHandle } from "../types/redis-types.js";
import type { RedisDriver } from "./RedisDriver.js";
import { RedisDriverError } from "../errors/RedisDriverError.js";

/**
 * No-op transaction context for Redis.
 *
 * Redis does not support multi-key transactions with isolation, so this context
 * is a thin passthrough that delegates to the driver's non-transactional methods.
 * Nested transaction() calls create a new context but provide no isolation guarantees.
 */
export class RedisTransactionContext implements ITransactionContext {
  private readonly handle: RedisTransactionHandle;
  private readonly driver: RedisDriver;
  private readonly repoFactory: RepositoryFactory | undefined;

  public constructor(
    handle: RedisTransactionHandle,
    driver: RedisDriver,
    repositoryFactory?: RepositoryFactory,
  ) {
    this.handle = handle;
    this.driver = driver;
    this.repoFactory = repositoryFactory;
  }

  public repository<E extends IEntity>(target: Constructor<E>): IProteusRepository<E> {
    if (!this.repoFactory) {
      throw new RedisDriverError("Transactional repositories are not configured");
    }
    return this.repoFactory(target);
  }

  public queryBuilder<E extends IEntity>(
    target: Constructor<E>,
  ): IProteusQueryBuilder<E> {
    return this.driver.createTransactionalQueryBuilder(target, this.handle);
  }

  public async client<T>(): Promise<T> {
    // Redis has no transactional isolation — the "tx-scoped" client is the
    // same ioredis instance the driver uses for non-transactional operations.
    // Callers can construct MULTI/EXEC pipelines from it when needed.
    return this.driver.acquireClient() as Promise<T>;
  }

  public async transaction<T>(
    fn: (ctx: RedisTransactionContext) => Promise<T>,
  ): Promise<T> {
    // Redis has no savepoints -- nested transactions are passthrough
    return fn(this);
  }

  public async commit(): Promise<void> {
    await this.driver.commitTransaction(this.handle);
  }

  public async rollback(): Promise<void> {
    await this.driver.rollbackTransaction(this.handle);
  }
}
