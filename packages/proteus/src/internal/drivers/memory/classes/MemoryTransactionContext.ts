import type { Constructor } from "@lindorm/types";
import type {
  IEntity,
  IProteusQueryBuilder,
  IProteusRepository,
  ITransactionContext,
} from "../../../../interfaces/index.js";
import type { RepositoryFactory } from "../../../types/repository-factory.js";
import type { MemoryTransactionHandle } from "../types/memory-store.js";
import type { MemoryDriver } from "./MemoryDriver.js";
import { MemoryDriverError } from "../errors/MemoryDriverError.js";

export class MemoryTransactionContext implements ITransactionContext {
  private readonly handle: MemoryTransactionHandle;
  private readonly driver: MemoryDriver;
  private readonly repoFactory: RepositoryFactory | undefined;

  public constructor(
    handle: MemoryTransactionHandle,
    driver: MemoryDriver,
    repositoryFactory?: RepositoryFactory,
  ) {
    this.handle = handle;
    this.driver = driver;
    this.repoFactory = repositoryFactory;
  }

  public repository<E extends IEntity>(target: Constructor<E>): IProteusRepository<E> {
    if (!this.repoFactory) {
      throw new MemoryDriverError("Transactional repositories are not configured");
    }
    return this.repoFactory(target);
  }

  public queryBuilder<E extends IEntity>(
    target: Constructor<E>,
  ): IProteusQueryBuilder<E> {
    return this.driver.createTransactionalQueryBuilder(target, this.handle);
  }

  public async client<T>(): Promise<T> {
    // The memory driver's effective tx-scoped "client" is the transaction's
    // in-memory store. Returning it lets tests / advanced callers peek or
    // mutate raw table state within the active transaction.
    return this.handle.store as unknown as T;
  }

  public async transaction<T>(
    fn: (ctx: MemoryTransactionContext) => Promise<T>,
  ): Promise<T> {
    // Push savepoint
    const savepoint = {
      tables: new Map(
        [...this.handle.store.tables].map(([k, t]) => [
          k,
          new Map([...t].map(([pk, row]) => [pk, structuredClone(row)])),
        ]),
      ),
      joinTables: new Map(
        [...this.handle.store.joinTables].map(([k, t]) => [
          k,
          new Map([...t].map(([pk, row]) => [pk, structuredClone(row)])),
        ]),
      ),
      collectionTables: new Map(
        [...this.handle.store.collectionTables].map(([k, ct]) => [
          k,
          new Map([...ct].map(([fk, rows]) => [fk, structuredClone(rows)])),
        ]),
      ),
      incrementCounters: new Map(this.handle.store.incrementCounters),
    };
    this.handle.savepointStack.push(savepoint);

    try {
      const result = await fn(this);
      this.handle.savepointStack.pop();
      return result;
    } catch (error) {
      // Restore from savepoint
      const restored = this.handle.savepointStack.pop();
      if (restored) {
        this.handle.store.tables = restored.tables;
        this.handle.store.joinTables = restored.joinTables;
        this.handle.store.collectionTables = restored.collectionTables;
        this.handle.store.incrementCounters = restored.incrementCounters;
      }
      throw error;
    }
  }

  public async commit(): Promise<void> {
    await this.driver.commitTransaction(this.handle);
  }

  public async rollback(): Promise<void> {
    await this.driver.rollbackTransaction(this.handle);
  }
}
