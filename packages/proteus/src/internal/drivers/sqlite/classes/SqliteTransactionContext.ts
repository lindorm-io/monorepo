import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type {
  IEntity,
  IProteusQueryBuilder,
  IProteusRepository,
  ITransactionContext,
} from "../../../../interfaces/index.js";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata.js";
import type { RepositoryFactory } from "../../../types/repository-factory.js";
import { SqliteTransactionError } from "../errors/SqliteTransactionError.js";
import type { SqliteTransactionHandle } from "../types/sqlite-transaction-handle.js";
import { commitTransaction } from "../utils/transaction/commit-transaction.js";
import { rollbackTransaction } from "../utils/transaction/rollback-transaction.js";
import { withSavepoint } from "../utils/transaction/with-savepoint.js";
import { SqliteQueryBuilder } from "./SqliteQueryBuilder.js";

export class SqliteTransactionContext implements ITransactionContext {
  private readonly handle: SqliteTransactionHandle;
  private readonly namespace: string | null;
  private readonly logger: ILogger | undefined;
  private readonly repoFactory: RepositoryFactory | undefined;

  constructor(
    handle: SqliteTransactionHandle,
    namespace?: string | null,
    logger?: ILogger,
    repositoryFactory?: RepositoryFactory,
  ) {
    this.handle = handle;
    this.namespace = namespace ?? null;
    this.logger = logger;
    this.repoFactory = repositoryFactory;
  }

  repository<E extends IEntity>(target: Constructor<E>): IProteusRepository<E> {
    if (!this.repoFactory) {
      throw new SqliteTransactionError("Transactional repositories are not configured", {
        code: "transactional_repositories_not_configured",
        title: "Transactional Repositories Not Configured",
        details:
          "The transaction context has no repository factory; configure one before requesting repositories.",
      });
    }
    return this.repoFactory(target);
  }

  queryBuilder<E extends IEntity>(target: Constructor<E>): IProteusQueryBuilder<E> {
    const metadata = getEntityMetadata(target);
    return new SqliteQueryBuilder<E>(
      metadata,
      this.handle.client,
      this.namespace,
      this.logger,
    );
  }

  async client<T>(): Promise<T> {
    return this.handle.client as unknown as T;
  }

  async transaction<T>(fn: (ctx: SqliteTransactionContext) => Promise<T>): Promise<T> {
    return withSavepoint(this.handle, () => fn(this));
  }

  async commit(): Promise<void> {
    commitTransaction(this.handle);
  }

  async rollback(): Promise<void> {
    rollbackTransaction(this.handle);
  }
}
