import { ServerError } from "@lindorm/errors";
import { CircuitBreakerVerifier } from "../../types";

const UNRECOVERABLE = new Set([
  ServerError.Status.HttpVersionNotSupported,
  ServerError.Status.NetworkAuthenticationRequired,
  ServerError.Status.NotExtended,
  ServerError.Status.NotImplemented,
  ServerError.Status.VariantAlsoNegotiates,
]);

type Config = {
  serverErrorThreshold?: number;
  clientErrorThreshold?: number;
};

export const defaultCircuitBreakerVerifier = (
  config: Config = {},
): CircuitBreakerVerifier => {
  const { serverErrorThreshold = 5, clientErrorThreshold = 1000 } = config;

  return async (ctx, breaker, error) => {
    if (UNRECOVERABLE.has(error.status)) {
      ctx.logger?.warn("Circuit breaker open: unrecoverable server error", {
        origin: breaker.origin,
        status: error.status,
        message: error.message,
      });
      return "open";
    }

    if (breaker.state === "half-open" && error.isServerError) {
      ctx.logger?.warn("Circuit breaker open: server error when half-open", {
        origin: breaker.origin,
        status: error.status,
        message: error.message,
      });
      return "open";
    }

    const errors = breaker.errors.filter((e) => e.status === error.status);
    const threshold = error.isServerError
      ? serverErrorThreshold
      : error.isClientError
        ? clientErrorThreshold
        : -1;

    if (threshold === -1) {
      ctx.logger?.warn("Circuit breaker closed: unknown error status", {
        origin: breaker.origin,
        status: error.status,
        message: error.message,
        amount: errors.length,
        threshold,
      });
      return "closed";
    }

    if (errors.length < threshold) {
      return "closed";
    }

    ctx.logger?.warn("Circuit breaker open: exceeding threshold", {
      origin: breaker.origin,
      status: error.status,
      message: error.message,
      amount: errors.length,
      threshold,
    });
    return "open";
  };
};
