import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import http from "http";
import Koa from "koa";
import type { AddressInfo } from "net";
import { join } from "path";
import request from "supertest";
import { PylonRouter } from "../../classes/PylonRouter.js";
import { createHttpBodyParserMiddleware } from "../../internal/middleware/http-body-parser-middleware.js";
import { httpErrorHandlerMiddleware } from "../../internal/middleware/http-error-handler-middleware.js";
import { httpResponseBodyMiddleware } from "../../internal/middleware/http-response-body-middleware.js";
import type { PylonHttpMiddleware } from "../../types/index.js";
import { useUpload } from "./use-upload.js";
import { afterEach, describe, expect, test, vi } from "vitest";

const logger = createMockLogger();
const fixture = join(__dirname, "..", "..", "__fixtures__", "upload.txt");

// A real HTTP server: logger → error handler → response body → body parser
// (formidable) → upload mount. Exactly the pipeline a PylonHttp app runs for an
// upload route, minus the parts an upload does not need.
const createUploadServer = async (
  mount: PylonHttpMiddleware,
): Promise<{ port: number; close: () => Promise<void> }> => {
  const router = new PylonRouter();
  router.upload("/upload", mount);

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
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
};

describe("useUpload", () => {
  afterEach(vi.clearAllMocks);

  test("POST writes a randomly-named file to disk and returns a 201 body", async () => {
    const root = await mkdtemp(join(tmpdir(), "lindorm-upload-"));
    const server = await createUploadServer(useUpload({ root }));

    try {
      const res = await request(`http://127.0.0.1:${server.port}`)
        .post("/upload/gallery/2026")
        .attach("file", fixture);

      expect(res.status).toBe(201);
      expect(res.body.files).toHaveLength(1);

      const [item] = res.body.files;
      expect(item.name).toMatch(/^f_[A-Za-z0-9]{32}\.txt$/);
      expect(item.path).toBe(`gallery/2026/${item.name}`);
      expect(item.size).toBe(9);
      expect(item.original_name).toBe("upload.txt");

      // The file actually lands on disk under the splat subdirectory.
      const written = join(root, "gallery", "2026", item.name);
      expect(await readFile(written, "utf8")).toBe("testfile\n");

      // No dot-prefixed temp is left behind.
      const entries = await readdir(join(root, "gallery", "2026"));
      expect(entries.every((e) => !e.startsWith("."))).toBe(true);
    } finally {
      await server.close();
    }
  });

  test("POST with a traversal splat is rejected with a 400", async () => {
    const root = await mkdtemp(join(tmpdir(), "lindorm-upload-"));

    // Drive the middleware directly: koa-router decodes the splat, so a decoded
    // `..` reaching the middleware is exactly what a traversal attempt looks
    // like once routing has run.
    const ctx: any = {
      method: "POST",
      params: { path: "../secret" },
      request: {
        files: {
          file: [
            {
              filepath: fixture,
              originalFilename: "x.txt",
              mimetype: "text/plain",
              size: 9,
            },
          ],
        },
      },
    };

    await expect(useUpload({ root })(ctx, vi.fn())).rejects.toMatchObject({
      status: 400,
      code: "upload_invalid_path",
    });
  });
});
