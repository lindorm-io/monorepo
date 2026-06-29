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

  constructor(
    handle: RedisTransactionHandle,
    driver: RedisDriver,
    repositoryFactory?: RepositoryFactory,
  ) {
    this.handle = handle;
    this.driver = driver;
    this.repoFactory = repositoryFactory;
  }

  repository<E extends IEntity>(target: Constructor<E>): IProteusRepository<E> {
    if (!this.repoFactory) {
      throw new RedisDriverError("Transactional repositories are not configured", {
        code: "transactional_repositories_not_configured",
        title: "Transactional Repositories Not Configured",
        details:
          "context.repository() was called but no repository factory was provided to the transaction context; configure transactional repositories before requesting one.",
      });
    }
    return this.repoFactory(target);
  }

  queryBuilder<E extends IEntity>(target: Constructor<E>): IProteusQueryBuilder<E> {
    return this.driver.createTransactionalQueryBuilder(target, this.handle);
  }

  async client<T>(): Promise<T> {
    // Redis has no transactional isolation — the "tx-scoped" client is the
    // same ioredis instance the driver uses for non-transactional operations.
    // Callers can construct MULTI/EXEC pipelines from it when needed.
    return this.driver.acquireClient() as Promise<T>;
  }

  async transaction<T>(fn: (ctx: RedisTransactionContext) => Promise<T>): Promise<T> {
    // Redis has no savepoints -- nested transactions are passthrough
    return fn(this);
  }

  async commit(): Promise<void> {
    await this.driver.commitTransaction(this.handle);
  }

  async rollback(): Promise<void> {
    await this.driver.rollbackTransaction(this.handle);
  }
}
