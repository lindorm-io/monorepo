import type { AbortReason } from "@lindorm/types";
import type { PylonHttpMiddleware } from "../../types/index.js";

export const createHttpAbortSignalMiddleware = (): PylonHttpMiddleware => {
  return async function httpAbortSignalMiddleware(ctx, next) {
    const controller = new AbortController();
    ctx.signal = controller.signal;

    // Listen on the RESPONSE stream, not the request. A POST request stream
    // emits "close" as soon as its body is fully consumed — before the handler
    // has written a response (writableEnded === false) — which would abort the
    // signal mid-handler and cancel any in-flight work threaded with ctx.signal
    // (e.g. DB queries). The response stream's "close" fires only after the
    // response finishes (where the writableEnded guard short-circuits) or when
    // the client genuinely disconnects early — which is exactly when we abort.
    const onClose = (): void => {
      if (ctx.res.writableEnded) return;

      const reason: AbortReason = {
        kind: "client-disconnect",
        correlationId: ctx.state?.metadata?.correlationId,
        requestId: ctx.state?.metadata?.id,
      };

      controller.abort(reason);
    };

    ctx.res.once("close", onClose);

    try {
      await next();
    } finally {
      ctx.res.off("close", onClose);
    }
  };
};
