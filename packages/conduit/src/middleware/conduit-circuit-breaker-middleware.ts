import { defaultConduitClassifier } from "../internal/utils/default-conduit-classifier";
import { CircuitBreaker, CircuitOpenError } from "@lindorm/breaker";
import { ILogger } from "@lindorm/logger";
import { ConduitError } from "../errors";
import type {
  ConduitCircuitBreakerCache,
  ConduitCircuitBreakerConfig,
  ConduitMiddleware,
} from "../types";

export const createConduitCircuitBreakerMiddleware = (
  config: ConduitCircuitBreakerConfig = {},
  logger?: ILogger,
  cache: ConduitCircuitBreakerCache = new Map(),
): ConduitMiddleware => {
  return async function conduitCircuitBreakerMiddleware(ctx, next) {
    let breaker = cache.get(ctx.req.origin);
    if (!breaker) {
      const origin = ctx.req.origin;

      breaker = new CircuitBreaker({
        name: `conduit:${origin}`,
        classifier: config.classifier ?? defaultConduitClassifier,
        threshold: config.threshold,
        window: config.window,
        halfOpenDelay: config.halfOpenDelay,
        halfOpenBackoff: config.halfOpenBackoff,
        halfOpenMaxDelay: config.halfOpenMaxDelay,
      });

      if (logger) {
        breaker.on("open", (event) => {
          logger.warn("Circuit breaker opened", { origin, failures: event.failures });
        });
        breaker.on("half-open", (event) => {
          logger.debug("Circuit breaker half-open", { origin, failures: event.failures });
        });
        breaker.on("closed", () => {
          logger.info("Circuit breaker closed", { origin });
        });
      }

      cache.set(origin, breaker);
    }
    try {
      await breaker.execute(() => next());
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        throw new ConduitError("Circuit breaker is open", {
          debug: { origin: ctx.req.origin },
        });
      }
      throw error;
    }
  };
};
