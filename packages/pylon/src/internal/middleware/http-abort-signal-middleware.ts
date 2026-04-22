import type { AbortReason } from "@lindorm/types";
import type { PylonHttpMiddleware } from "../../types/index.js";

export const createHttpAbortSignalMiddleware = (): PylonHttpMiddleware => {
  return async function httpAbortSignalMiddleware(ctx, next) {
    const controller = new AbortController();
    ctx.signal = controller.signal;

    const onClose = (): void => {
      if (ctx.res.writableEnded) return;

      const reason: AbortReason = {
        kind: "client-disconnect",
        correlationId: ctx.state?.metadata?.correlationId,
        requestId: ctx.state?.metadata?.id,
      };

      controller.abort(reason);
    };

    ctx.req.once("close", onClose);

    try {
      await next();
    } finally {
      ctx.req.off("close", onClose);
    }
  };
};
