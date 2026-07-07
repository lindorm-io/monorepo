import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import http from "http";
import Koa from "koa";
import type { AddressInfo } from "net";
import { join } from "path";
import { PylonRouter } from "../../classes/PylonRouter.js";
import { createHttpBodyParserMiddleware } from "../../internal/middleware/http-body-parser-middleware.js";
import { httpErrorHandlerMiddleware } from "../../internal/middleware/http-error-handler-middleware.js";
import { httpResponseBodyMiddleware } from "../../internal/middleware/http-response-body-middleware.js";
import type { IPylonFileUpload } from "../../interfaces/index.js";
import type { PylonHttpMiddleware } from "../../types/index.js";

const logger = createMockLogger();

export type UploadTestServer = {
  port: number;
  close: () => Promise<void>;
  // The last request's `ctx.files` slot, captured by a middleware wrapped
  // around the mount (useUpload never calls `next`, so a trailing middleware
  // would not run — the wrapper reads the slot after `await next()` resolves).
  captured: { files?: Array<IPylonFileUpload> };
};

// A real HTTP server running the exact pipeline a PylonHttp app runs for an
// upload route: logger → error handler → response body (snake-cases the wire) →
// body parser (formidable) → upload mount. `router.upload` registers the chain
// for both POST and PUT under `/upload{/*path}`.
export const createUploadServer = async (
  ...middleware: Array<PylonHttpMiddleware>
): Promise<UploadTestServer> => {
  const captured: { files?: Array<IPylonFileUpload> } = {};

  const capture: PylonHttpMiddleware = async (ctx, next) => {
    await next();
    captured.files = (ctx as any).files;
  };

  const router = new PylonRouter();
  router.upload("/upload", capture, ...middleware);

  const app = new Koa();
  app.use((async (ctx: any, next: any) => {
    ctx.logger = logger;
    await next();
  }) as any);
  app.use(httpErrorHandlerMiddleware as any);
  app.use(httpResponseBodyMiddleware as any);
  app.use(createHttpBodyParserMiddleware({ formidable: true }) as any);
  app.use(router.routes() as any).use(router.allowedMethods() as any);

  const server = http.createServer(app.callback());
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const port = (server.address() as AddressInfo).port;

  return {
    port,
    captured,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
};

// Per-test target directory: tests write real files, so never reuse a committed
// fixture dir.
export const makeUploadRoot = (): Promise<string> =>
  mkdtemp(join(tmpdir(), "lindorm-upload-"));

// Write a temp source file of an exact byte length (filled with `A`) for size
// boundary tests, returning its path.
export const writeSizedFile = async (
  dir: string,
  name: string,
  bytes: number,
): Promise<string> => {
  const path = join(dir, name);
  await writeFile(path, Buffer.alloc(bytes, 0x41));
  return path;
};

// Write a temp source file with exact string content, returning its path.
export const writeContentFile = async (
  dir: string,
  name: string,
  content: string,
): Promise<string> => {
  const path = join(dir, name);
  await writeFile(path, content);
  return path;
};
