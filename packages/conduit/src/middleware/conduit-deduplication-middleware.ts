import { ConduitMiddleware, ConduitResponse } from "../types";

type InflightEntry = {
  promise: Promise<ConduitResponse>;
  resolve: (res: ConduitResponse) => void;
  reject: (err: unknown) => void;
};

export const createConduitDeduplicationMiddleware = (): ConduitMiddleware => {
  const inflight = new Map<string, InflightEntry>();

  return async function conduitDeduplicationMiddleware(ctx, next) {
    const method = ctx.req.config.method;

    if (method !== "GET" && method !== "HEAD") {
      await next();
      return;
    }

    const key = `${method}:${ctx.req.url}:${JSON.stringify(ctx.req.query)}`;

    const existing = inflight.get(key);
    if (existing) {
      ctx.res = { ...(await existing.promise) };
      return;
    }

    let resolve!: (res: ConduitResponse) => void;
    let reject!: (err: unknown) => void;

    const promise = new Promise<ConduitResponse>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    inflight.set(key, { promise, resolve, reject });

    try {
      await next();
      resolve({ ...ctx.res });
    } catch (err) {
      reject(err);
      throw err;
    } finally {
      inflight.delete(key);
    }
  };
};
