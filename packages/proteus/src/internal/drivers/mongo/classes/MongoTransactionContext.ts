import type { Constructor } from "@lindorm/types";
import type {
  IEntity,
  IProteusQueryBuilder,
  IProteusRepository,
  ITransactionContext,
} from "../../../../interfaces";
import type { RepositoryFactory } from "#internal/types/repository-factory";
import type { MongoTransactionHandle } from "../types/mongo-types";
import type { MongoDriver } from "./MongoDriver";
import { MongoDriverError } from "../errors/MongoDriverError";

/**
 * Transaction context for MongoDB.
 *
 * Wraps a ClientSession and provides scoped repositories and query builders.
 * Nested transaction() calls share the existing session (no savepoints in MongoDB).
 */
export class MongoTransactionContext implements ITransactionContext {
  private readonly handle: MongoTransactionHandle;
  private readonly driver: MongoDriver;
  private readonly repoFactory: RepositoryFactory | undefined;

  public constructor(
    handle: MongoTransactionHandle,
    driver: MongoDriver,
    repositoryFactory?: RepositoryFactory,
  ) {
    this.handle = handle;
    this.driver = driver;
    this.repoFactory = repositoryFactory;
  }

  public repository<E extends IEntity>(target: Constructor<E>): IProteusRepository<E> {
    if (!this.repoFactory) {
      throw new MongoDriverError("Transactional repositories are not configured");
    }
    return this.repoFactory(target);
  }

  public queryBuilder<E extends IEntity>(
    target: Constructor<E>,
  ): IProteusQueryBuilder<E> {
    return this.driver.createTransactionalQueryBuilder(target, this.handle);
  }

  public async transaction<T>(
    fn: (ctx: MongoTransactionContext) => Promise<T>,
  ): Promise<T> {
    // MongoDB has no savepoints — nested transactions share the session
    return fn(this);
  }

  public async commit(): Promise<void> {
    await this.driver.commitTransaction(this.handle);
  }

  public async rollback(): Promise<void> {
    await this.driver.rollbackTransaction(this.handle);
  }
}
