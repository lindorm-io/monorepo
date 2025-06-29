import { ConduitError } from "../../errors";
import { ConduitCircuitBreakerCache } from "../../types";

export const waitForProbe = (
  cache: ConduitCircuitBreakerCache,
  origin: string,
): Promise<void> => {
  const isBreakerResolved = (origin: string): boolean => {
    const breaker = cache.get(origin);
    return !breaker || !breaker.isProbing;
  };

  return new Promise<void>((resolve, reject) => {
    let interval: NodeJS.Timeout | undefined = undefined;
    let timeout: NodeJS.Timeout | undefined = undefined;

    if (isBreakerResolved(origin)) {
      return resolve();
    }

    interval = setInterval(() => {
      if (isBreakerResolved(origin)) {
        if (interval) clearInterval(interval);
        if (timeout) clearTimeout(timeout);

        return resolve();
      }
    }, 25);

    timeout = setTimeout(() => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);

      if (isBreakerResolved(origin)) {
        return resolve();
      }

      return reject(
        new ConduitError("Circuit breaker is half-open", { debug: { origin } }),
      );
    }, 3000);
  });
};
