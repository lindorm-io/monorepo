import Koa from "koa";
import http from "http";
import type { AddressInfo } from "net";
import { PylonRouter } from "../../classes/PylonRouter.js";
import { httpErrorHandlerMiddleware } from "../../internal/middleware/http-error-handler-middleware.js";
import { httpResponseBodyMiddleware } from "../../internal/middleware/http-response-body-middleware.js";
import type { PylonHttpMiddleware } from "../../types/index.js";

export type StaticTestServer = {
  port: number;
  close: () => Promise<void>;
};

// Build a real HTTP server whose only route is a static mount at `mountPath`.
// The error-handler + response-body middleware are included so misses surface
// the pylon error body shape and directory listings get snake-cased — exactly
// the pipeline a PylonHttp app runs.
export const createStaticServer = async (
  mountPath: string,
  ...middleware: Array<PylonHttpMiddleware>
): Promise<StaticTestServer> => {
  const router = new PylonRouter();
  router.static(mountPath, ...middleware);

  const app = new Koa();
  app.use(httpErrorHandlerMiddleware as any);
  app.use(httpResponseBodyMiddleware as any);
  app.use(router.routes() as any).use(router.allowedMethods() as any);

  const server = http.createServer(app.callback());
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const port = (server.address() as AddressInfo).port;

  return {
    port,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
};

// Build a server from a pre-assembled router (used for scanner-driven mounts).
export const createServerFromRouter = async (
  router: PylonRouter,
): Promise<StaticTestServer> => {
  const app = new Koa();
  app.use(httpErrorHandlerMiddleware as any);
  app.use(httpResponseBodyMiddleware as any);
  app.use(router.routes() as any).use(router.allowedMethods() as any);

  const server = http.createServer(app.callback());
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const port = (server.address() as AddressInfo).port;

  return {
    port,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
};

export type RawResponse = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
};

// Raw http.request: no fetch normalisation of `%2e%2e`/`%2F`, and no automatic
// Content-Encoding decompression — both essential for these tests.
export const rawRequest = (
  port: number,
  path: string,
  options: { method?: string; headers?: Record<string, string> } = {},
): Promise<RawResponse> =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: options.method ?? "GET",
        headers: options.headers,
      },
      (res) => {
        const chunks: Array<Buffer> = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
          }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });

// A stable subset of headers for snapshotting — strips volatile values (date,
// connection) and per-checkout validators (etag, last-modified) that callers
// assert separately.
export const stableHeaders = (
  headers: http.IncomingHttpHeaders,
  extra: Array<string> = [],
): Record<string, string | undefined> => {
  const keys = [
    "content-type",
    "content-length",
    "content-encoding",
    "content-range",
    "cache-control",
    "accept-ranges",
    "vary",
    "allow",
    ...extra,
  ];

  const result: Record<string, string | undefined> = {};
  for (const key of keys) {
    if (key in headers) {
      result[key] = headers[key] as string | undefined;
    }
  }
  return result;
};
