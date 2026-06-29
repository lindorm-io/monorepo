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
import { PostgresTransactionError } from "../errors/PostgresTransactionError.js";
import type { PostgresTransactionHandle } from "../types/postgres-transaction-handle.js";
import { commitTransaction } from "../utils/transaction/commit-transaction.js";
import { rollbackTransaction } from "../utils/transaction/rollback-transaction.js";
import { withSavepoint } from "../utils/transaction/with-savepoint.js";
import { PostgresQueryBuilder } from "./PostgresQueryBuilder.js";

export class TransactionContext implements ITransactionContext {
  private readonly handle: PostgresTransactionHandle;
  private readonly namespace: string | null;
  private readonly logger: ILogger | undefined;
  private readonly repoFactory: RepositoryFactory | undefined;

  constructor(
    handle: PostgresTransactionHandle,
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
      throw new PostgresTransactionError(
        "Transactional repositories are not configured",
        {
          code: "transactional_repositories_not_configured",
          title: "Transactional Repositories Not Configured",
          details:
            "This transaction context has no repository factory, so transactional repositories cannot be resolved.",
        },
      );
    }
    return this.repoFactory(target);
  }

  queryBuilder<E extends IEntity>(target: Constructor<E>): IProteusQueryBuilder<E> {
    const metadata = getEntityMetadata(target);
    return new PostgresQueryBuilder<E>(
      metadata,
      this.handle.client,
      this.namespace,
      this.logger,
    );
  }

  async client<T>(): Promise<T> {
    return this.handle.client as unknown as T;
  }

  async transaction<T>(fn: (ctx: TransactionContext) => Promise<T>): Promise<T> {
    return withSavepoint(this.handle, () => fn(this));
  }

  async commit(): Promise<void> {
    await commitTransaction(this.handle);
  }

  async rollback(): Promise<void> {
    await rollbackTransaction(this.handle);
  }
}
