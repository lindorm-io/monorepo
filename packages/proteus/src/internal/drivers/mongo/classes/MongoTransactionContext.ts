import type { Constructor } from "@lindorm/types";
import type {
  IEntity,
  IProteusQueryBuilder,
  IProteusRepository,
  ITransactionContext,
} from "../../../../interfaces/index.js";
import type { RepositoryFactory } from "../../../types/repository-factory.js";
import type { MongoTransactionHandle } from "../types/mongo-types.js";
import type { MongoDriver } from "./MongoDriver.js";
import { MongoDriverError } from "../errors/MongoDriverError.js";

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

  constructor(
    handle: MongoTransactionHandle,
    driver: MongoDriver,
    repositoryFactory?: RepositoryFactory,
  ) {
    this.handle = handle;
    this.driver = driver;
    this.repoFactory = repositoryFactory;
  }

  repository<E extends IEntity>(target: Constructor<E>): IProteusRepository<E> {
    if (!this.repoFactory) {
      throw new MongoDriverError("Transactional repositories are not configured", {
        code: "unsupported_operation",
        title: "Unsupported Operation",
        details:
          "This transaction context was created without a repository factory, so transactional repositories are unavailable.",
      });
    }
    return this.repoFactory(target);
  }

  queryBuilder<E extends IEntity>(target: Constructor<E>): IProteusQueryBuilder<E> {
    return this.driver.createTransactionalQueryBuilder(target, this.handle);
  }

  async client<T>(): Promise<T> {
    // The transaction-scoped client for MongoDB is the ClientSession — any
    // driver calls made with `{ session }` participate in the open tx.
    return this.handle.session as unknown as T;
  }

  async transaction<T>(fn: (ctx: MongoTransactionContext) => Promise<T>): Promise<T> {
    // MongoDB has no savepoints — nested transactions share the session
    return fn(this);
  }

  async commit(): Promise<void> {
    await this.driver.commitTransaction(this.handle);
  }

  async rollback(): Promise<void> {
    await this.driver.rollbackTransaction(this.handle);
  }
}
