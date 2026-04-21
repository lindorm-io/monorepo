import type { CircuitBreakerOptions, ICircuitBreaker } from "@lindorm/breaker";

export type ConduitCircuitBreakerCache = Map<string, ICircuitBreaker>;

export type ConduitCircuitBreakerConfig = Partial<
  Omit<CircuitBreakerOptions, "name" | "classifier">
> & {
  classifier?: CircuitBreakerOptions["classifier"];
};
