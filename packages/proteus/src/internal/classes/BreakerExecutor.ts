import type { ICircuitBreaker } from "@lindorm/breaker";
import { CircuitOpenError as BreakerCircuitOpenError } from "@lindorm/breaker";
import type { DeepPartial, Predicate } from "@lindorm/types";
import { CircuitOpenError } from "../../errors/CircuitOpenError.js";
import type { IEntity } from "../../interfaces/Entity.js";
import type { DeleteOptions, FindOptions } from "../../types/index.js";
import type { QueryScope } from "../entity/types/metadata.js";
import type { IRepositoryExecutor } from "../interfaces/RepositoryExecutor.js";

/**
 * Wraps an IRepositoryExecutor so every database operation goes through
 * the circuit breaker. When the breaker is open, operations fail fast
 * with a Proteus-native CircuitOpenError instead of waiting for a
 * network timeout.
 */
export class BreakerExecutor<E extends IEntity> implements IRepositoryExecutor<E> {
  private readonly inner: IRepositoryExecutor<E>;
  private readonly breaker: ICircuitBreaker;

  public constructor(inner: IRepositoryExecutor<E>, breaker: ICircuitBreaker) {
    this.inner = inner;
    this.breaker = breaker;
  }

  public executeInsert = (entity: E): Promise<E> =>
    this.run(() => this.inner.executeInsert(entity));

  public executeUpdate = (entity: E): Promise<E> =>
    this.run(() => this.inner.executeUpdate(entity));

  public executeDelete = (
    criteria: Predicate<E>,
    options?: DeleteOptions,
  ): Promise<void> => this.run(() => this.inner.executeDelete(criteria, options));

  public executeSoftDelete = (criteria: Predicate<E>): Promise<void> =>
    this.run(() => this.inner.executeSoftDelete(criteria));

  public executeRestore = (criteria: Predicate<E>): Promise<void> =>
    this.run(() => this.inner.executeRestore(criteria));

  public executeDeleteExpired = (): Promise<void> =>
    this.run(() => this.inner.executeDeleteExpired());

  public executeTtl = (criteria: Predicate<E>): Promise<number | null> =>
    this.run(() => this.inner.executeTtl(criteria));

  public executeFind = (
    criteria: Predicate<E>,
    options: FindOptions<E>,
    operationScope?: QueryScope,
  ): Promise<Array<E>> =>
    this.run(() => this.inner.executeFind(criteria, options, operationScope));

  public executeCount = (
    criteria: Predicate<E>,
    options: FindOptions<E>,
  ): Promise<number> => this.run(() => this.inner.executeCount(criteria, options));

  public executeExists = (criteria: Predicate<E>): Promise<boolean> =>
    this.run(() => this.inner.executeExists(criteria));

  public executeIncrement = (
    criteria: Predicate<E>,
    property: keyof E,
    value: number,
  ): Promise<void> =>
    this.run(() => this.inner.executeIncrement(criteria, property, value));

  public executeDecrement = (
    criteria: Predicate<E>,
    property: keyof E,
    value: number,
  ): Promise<void> =>
    this.run(() => this.inner.executeDecrement(criteria, property, value));

  public executeInsertBulk = (entities: Array<E>): Promise<Array<E>> =>
    this.run(() => this.inner.executeInsertBulk(entities));

  public executeUpdateMany = (
    criteria: Predicate<E>,
    update: DeepPartial<E>,
    options?: { systemFilters?: boolean },
  ): Promise<number> =>
    this.run(() => this.inner.executeUpdateMany(criteria, update, options));

  private run = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await this.breaker.execute(fn);
    } catch (error) {
      if (error instanceof BreakerCircuitOpenError) {
        throw new CircuitOpenError(error.message, { debug: (error as any).debug });
      }
      throw error;
    }
  };
}
