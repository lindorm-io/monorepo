import type { ICircuitBreaker } from "@lindorm/breaker";
import { CircuitOpenError as BreakerCircuitOpenError } from "@lindorm/breaker";
import { AbortError } from "@lindorm/errors";
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

  constructor(inner: IRepositoryExecutor<E>, breaker: ICircuitBreaker) {
    this.inner = inner;
    this.breaker = breaker;
  }

  executeInsert = (entity: E): Promise<E> =>
    this.run(() => this.inner.executeInsert(entity));

  executeUpdate = (entity: E): Promise<E> =>
    this.run(() => this.inner.executeUpdate(entity));

  executeDelete = (criteria: Predicate<E>, options?: DeleteOptions): Promise<void> =>
    this.run(() => this.inner.executeDelete(criteria, options));

  executeSoftDelete = (criteria: Predicate<E>): Promise<void> =>
    this.run(() => this.inner.executeSoftDelete(criteria));

  executeRestore = (criteria: Predicate<E>): Promise<void> =>
    this.run(() => this.inner.executeRestore(criteria));

  executeDeleteExpired = (): Promise<void> =>
    this.run(() => this.inner.executeDeleteExpired());

  executeTtl = (criteria: Predicate<E>): Promise<number | null> =>
    this.run(() => this.inner.executeTtl(criteria));

  executeFind = (
    criteria: Predicate<E>,
    options: FindOptions<E>,
    operationScope?: QueryScope,
  ): Promise<Array<E>> =>
    this.run(() => this.inner.executeFind(criteria, options, operationScope));

  executeCount = (criteria: Predicate<E>, options: FindOptions<E>): Promise<number> =>
    this.run(() => this.inner.executeCount(criteria, options));

  executeExists = (criteria: Predicate<E>): Promise<boolean> =>
    this.run(() => this.inner.executeExists(criteria));

  executeIncrement = (
    criteria: Predicate<E>,
    property: keyof E,
    value: number,
  ): Promise<void> =>
    this.run(() => this.inner.executeIncrement(criteria, property, value));

  executeDecrement = (
    criteria: Predicate<E>,
    property: keyof E,
    value: number,
  ): Promise<void> =>
    this.run(() => this.inner.executeDecrement(criteria, property, value));

  executeInsertBulk = (entities: Array<E>): Promise<Array<E>> =>
    this.run(() => this.inner.executeInsertBulk(entities));

  executeUpdateMany = (
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
        throw new CircuitOpenError(error.message, {
          code: "circuit_open",
          title: "Circuit Open",
          details:
            "The repository circuit breaker is open and is failing fast instead of calling the database.",
          debug: (error as any).debug,
        });
      }
      // AbortError is a client-initiated cancellation, not a backend failure.
      // Pass it through without letting it influence the circuit breaker.
      // Note: the breaker.execute(fn) call above already saw the error before
      // re-throwing it; classifiers that return "ignorable" for AbortError
      // (the recommended default) prevent it from tripping the breaker. We
      // still rethrow the original AbortError here so callers can match on it.
      if (error instanceof AbortError) {
        throw error;
      }
      throw error;
    }
  };
}
