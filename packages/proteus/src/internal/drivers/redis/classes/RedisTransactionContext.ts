import type { Constructor } from "@lindorm/types";
import type {
  IEntity,
  IProteusQueryBuilder,
  IProteusRepository,
  ITransactionContext,
} from "../../../../interfaces";
import type { RepositoryFactory } from "../../../types/repository-factory";
import type { RedisTransactionHandle } from "../types/redis-types";
import type { RedisDriver } from "./RedisDriver";
import { RedisDriverError } from "../errors/RedisDriverError";

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
