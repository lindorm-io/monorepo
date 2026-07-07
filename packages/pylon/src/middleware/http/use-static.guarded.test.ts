import { ClientError } from "@lindorm/errors";
import { join } from "path";
import {
  createStaticServer,
  rawRequest,
  type StaticTestServer,
} from "../../__fixtures__/static-helpers/http-server.js";
import type { PylonHttpMiddleware } from "../../types/index.js";
import { useStatic } from "./use-static.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const root = join(__dirname, "..", "..", "__fixtures__", "static-assets");

const denyingGuard: PylonHttpMiddleware = async () => {
  throw new ClientError("Not authorised", {
    status: ClientError.Status.Unauthorized,
    code: "unauthorized",
  });
};

const passingGuard: PylonHttpMiddleware = async (ctx, next) => {
  ctx.set("X-Guard", "passed");
  await next();
};

describe("useStatic — guarded array-form mount", () => {
  let guarded: StaticTestServer;
  let open: StaticTestServer;

  beforeAll(async () => {
    guarded = await createStaticServer("/private", denyingGuard, useStatic({ root }));
    open = await createStaticServer("/private", passingGuard, useStatic({ root }));
  });

  afterAll(async () => {
    await Promise.all([guarded.close(), open.close()]);
  });

  test("a throwing guard short-circuits with 401 and never serves the file", async () => {
    const res = await rawRequest(guarded.port, "/private/sample.txt");
    const parsed = JSON.parse(res.body.toString());

    expect(res.status).toBe(401);
    expect(parsed.error.code).toBe("unauthorized");
    expect(res.body.toString()).not.toContain("0123456789");
  });

  test("a passing guard runs before serving and the file is delivered", async () => {
    const res = await rawRequest(open.port, "/private/sample.txt");

    expect(res.status).toBe(200);
    expect(res.headers["x-guard"]).toBe("passed");
    expect(res.body.toString()).toBe("0123456789".repeat(10));
  });
});
