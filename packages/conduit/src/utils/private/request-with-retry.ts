import { calculateRetry } from "@lindorm/retry";
import { ConduitError } from "../../errors";
import { ConduitContext, ConduitResponse } from "../../types";
import { sleep } from "./sleep";

export type CommonRequestFunction<T = any> = () => Promise<ConduitResponse<T>>;

export const requestWithRetry = async <T = any>(
  fn: CommonRequestFunction<T>,
  ctx: ConduitContext,
): Promise<ConduitResponse<T>> => {
  let attempt = 1;

  for (;;) {
    try {
      return await fn();
    } catch (raw: any) {
      const err =
        raw instanceof ConduitError
          ? raw
          : raw.isAxiosError
            ? ConduitError.fromAxiosError(raw)
            : new ConduitError(raw.message || "Unknown error", { error: raw });

      if (attempt >= 100) throw err;

      if (ctx.req.signal?.aborted) throw err;

      if (!ctx.req.retryCallback(err, attempt, ctx.req.retryConfig)) {
        ctx.logger?.debug("Conduit retry callback returned false, not retrying");

        throw err;
      }

      const timeout = calculateRetry(attempt, ctx.req.retryConfig);
      const nextAttempt = attempt + 1;

      ctx.logger?.debug("Conduit request failed, retrying after timeout", {
        nextAttempt,
        timeout,
      });

      await sleep(timeout);

      attempt = nextAttempt;
    }
  }
};
