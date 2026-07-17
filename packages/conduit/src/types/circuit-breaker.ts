import type { CircuitBreakerSettings, ICircuitBreaker } from "@lindorm/breaker";

export type ConduitCircuitBreakerCache = Map<string, ICircuitBreaker>;

export type ConduitCircuitBreakerConfig = Partial<
  Omit<CircuitBreakerSettings, "name" | "classifier">
> & {
  classifier?: CircuitBreakerSettings["classifier"];
};
