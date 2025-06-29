import { ConduitError } from "../errors";
import {
  Breaker,
  CircuitBreakerVerifier,
  ConduitCircuitBreakerCache,
  ConduitMiddleware,
} from "../types";
import { defaultCircuitBreakerVerifier, waitForProbe } from "../utils/private";

type Config = {
  verifier?: CircuitBreakerVerifier;
  expiration?: number;
  serverErrorThreshold?: number;
  clientErrorThreshold?: number;
};

export const createConduitCircuitBreakerMiddleware = (
  config: Config = {},
  cache: ConduitCircuitBreakerCache = new Map(),
): ConduitMiddleware => {
  const expirationMs = (config.expiration ?? 60 * 2) * 1000;

  const verifier = config.verifier ?? defaultCircuitBreakerVerifier(config);

  return async function conduitCircuitBreakerMiddleware(ctx, next) {
    const origin = new URL(ctx.req.url).origin;

    await waitForProbe(cache, origin);

    const existing = cache.get(origin);
    if (existing?.state === "closed" && Date.now() > existing.timestamp + expirationMs) {
      ctx.logger?.debug("Circuit breaker cleared", { origin });
      cache.delete(origin);
    }

    const fresh = cache.get(origin);
    if (fresh?.state === "open" && Date.now() > fresh.timestamp + expirationMs) {
      fresh.isProbing = true;
      fresh.state = "half-open";
      cache.set(origin, fresh);
    }

    const current = cache.get(origin);
    if (current?.state === "open") {
      throw new ConduitError("Circuit breaker is open", { debug: { origin } });
    }

    try {
      await next();

      const breaker = cache.get(origin);

      if (breaker?.state === "half-open") {
        ctx.logger?.debug("Circuit breaker cleared", { origin });
        cache.delete(origin);
      }
    } catch (error) {
      if (!(error instanceof ConduitError)) {
        throw error;
      }

      const init = cache.get(origin) ?? {
        origin,
        errors: [],
        isProbing: false,
        state: "closed",
        timestamp: Date.now(),
      };

      init.errors.push(error);

      if (init.errors.length === 1) {
        ctx.logger?.debug("Circuit breaker initialised", {
          origin: init.origin,
          status: error.status,
          message: error.message,
          amount: init.errors.length,
        });
      }

      cache.set(origin, init);

      const breaker = cache.get(origin) as Breaker;
      const state = await verifier(ctx, { ...breaker }, error);

      breaker.isProbing = false;
      breaker.state = state;

      switch (state) {
        case "open":
          breaker.timestamp = Date.now();
          break;

        default:
          break;
      }

      cache.set(origin, breaker);

      throw error;
    }
  };
};
