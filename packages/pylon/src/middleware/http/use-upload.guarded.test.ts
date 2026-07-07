import { ClientError } from "@lindorm/errors";
import { readdir } from "node:fs/promises";
import { join } from "path";
import request from "supertest";
import {
  createUploadServer,
  makeUploadRoot,
  type UploadTestServer,
} from "../../__fixtures__/upload-helpers/http-server.js";
import type { PylonHttpMiddleware } from "../../types/index.js";
import { useUpload } from "./use-upload.js";
import { afterEach, describe, expect, test } from "vitest";

const fixture = join(__dirname, "..", "..", "__fixtures__", "upload.txt");

let server: UploadTestServer | undefined;

afterEach(async () => {
  if (server) await server.close();
  server = undefined;
});

const url = (): string => `http://127.0.0.1:${server!.port}`;

const denyingGuard: PylonHttpMiddleware = async () => {
  throw new ClientError("Not authorised", {
    status: ClientError.Status.Unauthorized,
    code: "unauthorized",
    type: "urn:lindorm:pylon:error:unauthorized",
  });
};

describe("useUpload guarded mount", () => {
  test("a denying guard short-circuits with 401 and writes nothing to disk", async () => {
    const root = await makeUploadRoot();
    server = await createUploadServer(denyingGuard, useUpload({ root }));

    const res = await request(url()).post("/upload/pics").attach("file", fixture);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");

    // The guard ran before useUpload, so nothing was written.
    expect(await readdir(root)).toEqual([]);
    expect(server.captured.files).toBeUndefined();
  });

  test("_middleware → guard → useUpload run in order on success", async () => {
    const root = await makeUploadRoot();
    const order: Array<string> = [];

    const rootMiddleware: PylonHttpMiddleware = async (ctx, next) => {
      order.push("root");
      ctx.set("X-Upload-Root-Middleware", "1");
      await next();
    };
    const guard: PylonHttpMiddleware = async (ctx, next) => {
      order.push("guard");
      ctx.set("X-Upload-Guard", "1");
      await next();
    };

    server = await createUploadServer(rootMiddleware, guard, useUpload({ root }));

    const res = await request(url()).post("/upload/pics").attach("file", fixture);

    expect(res.status).toBe(201);
    // Both guards ran (their markers are set) and useUpload ran last (201 + a
    // populated context slot).
    expect(res.headers["x-upload-root-middleware"]).toBe("1");
    expect(res.headers["x-upload-guard"]).toBe("1");
    expect(order).toEqual(["root", "guard"]);
    expect(server.captured.files).toHaveLength(1);
  });
});
