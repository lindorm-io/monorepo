import { ConduitError } from "../errors";
import { ConduitContext } from "./conduit";

export type CircuitBreakerState = "open" | "closed" | "half-open";

export type CircuitBreakerVerifier = (
  ctx: ConduitContext,
  breaker: Breaker,
  error: ConduitError,
) => Promise<CircuitBreakerState>;

export type Breaker = {
  origin: string;
  errors: Array<ConduitError>;
  isProbing: boolean;
  state: CircuitBreakerState;
  timestamp: number;
};

export type ConduitCircuitBreakerCache = Map<string, Breaker>;
