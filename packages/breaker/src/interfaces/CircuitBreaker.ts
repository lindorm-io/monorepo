import type { CircuitBreakerState } from "../types/circuit-breaker";

export interface ICircuitBreaker {
  readonly name: string;
  readonly state: CircuitBreakerState;
  readonly isOpen: boolean;
  readonly isClosed: boolean;
  readonly isHalfOpen: boolean;

  execute<T>(fn: () => Promise<T>): Promise<T>;
  reset(): void;
}
