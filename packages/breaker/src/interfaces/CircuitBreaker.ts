import type {
  CircuitBreakerState,
  StateChangeListener,
} from "../types/circuit-breaker.js";

export interface ICircuitBreaker {
  readonly name: string;
  readonly state: CircuitBreakerState;
  readonly isOpen: boolean;
  readonly isClosed: boolean;
  readonly isHalfOpen: boolean;

  execute<T>(fn: () => Promise<T>): Promise<T>;
  open(): void;
  close(): void;
  reset(): void;
  on(event: "open", listener: StateChangeListener): void;
  on(event: "half-open", listener: StateChangeListener): void;
  on(event: "closed", listener: StateChangeListener): void;
}
