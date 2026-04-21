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

  public constructor(
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

  public repository<E extends IEntity>(target: Constructor<E>): IProteusRepository<E> {
    if (!this.repoFactory) {
      throw new SqliteTransactionError("Transactional repositories are not configured");
    }
    return this.repoFactory(target);
  }

  public queryBuilder<E extends IEntity>(
    target: Constructor<E>,
  ): IProteusQueryBuilder<E> {
    const metadata = getEntityMetadata(target);
    return new SqliteQueryBuilder<E>(
      metadata,
      this.handle.client,
      this.namespace,
      this.logger,
    );
  }

  public async transaction<T>(
    fn: (ctx: SqliteTransactionContext) => Promise<T>,
  ): Promise<T> {
    return withSavepoint(this.handle, () => fn(this));
  }

  public async commit(): Promise<void> {
    commitTransaction(this.handle);
  }

  public async rollback(): Promise<void> {
    rollbackTransaction(this.handle);
  }
}
