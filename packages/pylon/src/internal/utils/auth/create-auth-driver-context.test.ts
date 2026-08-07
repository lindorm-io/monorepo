// The NARROW seam handed to an auth driver. Two things are asserted here and
// they pull in opposite directions:
//
//  1. `kv` IS on it — pylon's AUTHORITATIVE ephemeral session, never `cache`. A
//     driver resolving an opaque token against its own store is doing an
//     authoritative lookup; a token record is not disposable.
//  2. NOTHING ELSE is. No cookies, no session writes, no `ctx.state` — every
//     control a third-party driver could weaken by omission stays on pylon's
//     side of the seam, enforced by the compiler rather than by documentation.

import { Aegis } from "@lindorm/aegis";
import { Amphora } from "@lindorm/amphora";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createMockProteusSource } from "@lindorm/proteus/mocks/vitest";
import { describe, expect, test, vi } from "vitest";
import { createDependenciesMiddleware } from "../../middleware/common-dependencies-middleware.js";
import { createAuthDriverContext } from "./create-auth-driver-context.js";

/**
 * A ctx built by the REAL dependencies middleware, so `ctx.kv` and `ctx.cache`
 * are bound exactly as they are in a live request — two separately configured
 * sources, both lazy.
 */
const buildCtx = async (options: { kv?: any; cache?: any; db?: any }): Promise<any> => {
  const ctx: any = {
    logger: createMockLogger(),
    request: {},
    state: {
      app: { environment: "test" },
      metadata: { correlationId: "test-correlation" },
    },
  };

  await createDependenciesMiddleware(options as any)(ctx, vi.fn());

  return ctx;
};

/** A source whose sessions are tagged, so the two are told apart by identity. */
const taggedSource = async (tag: string) => {
  const source = await createMockProteusSource();
  source.session.mockReturnValue({ tag } as any);
  return source;
};

/**
 * ⚠ Assigned onto the ctx, never spread into a copy: `ctx.kv` is a lazy getter,
 * and a spread would EVALUATE it — defeating the laziness the last test asserts.
 */
const driverContext = (ctx: any) => {
  const logger = createMockLogger();
  const amphora = new Amphora({ logger });

  ctx.amphora = amphora;
  ctx.aegis = new Aegis({ amphora, logger });

  return createAuthDriverContext(ctx);
};

describe("createAuthDriverContext", () => {
  test("should hand the driver the AUTHORITATIVE kv session, never the cache one", async () => {
    const kv = await taggedSource("kv");
    const cache = await taggedSource("cache");

    const ctx = await buildCtx({ kv, cache });

    const context = driverContext(ctx);

    expect(context.kv).toEqual({ tag: "kv" });
    expect(context.kv).not.toEqual({ tag: "cache" });
    expect(cache.session).not.toHaveBeenCalled();
  });

  test("should hand the driver undefined when no kv source is configured", async () => {
    const cache = await taggedSource("cache");

    const ctx = await buildCtx({ cache });

    expect(driverContext(ctx).kv).toBeUndefined();
  });

  // `ctx.kv` is lazy so a request that never touches storage never opens a
  // session; building the driver context must not defeat that.
  test("should not open the kv session until the driver reads it", async () => {
    const kv = await taggedSource("kv");

    const ctx = await buildCtx({ kv });
    const context = driverContext(ctx);

    expect(kv.session).not.toHaveBeenCalled();

    expect(context.kv).toEqual({ tag: "kv" });
    expect(kv.session).toHaveBeenCalledTimes(1);
  });

  test("should expose nothing beyond the narrow seam", async () => {
    const ctx = await buildCtx({ kv: await taggedSource("kv") });

    const context = driverContext(ctx);

    expect(Object.keys(context).sort()).toEqual([
      "aegis",
      "amphora",
      "conduit",
      "environment",
      "kv",
      "logger",
    ]);

    for (const key of ["cookies", "session", "state", "db", "bus", "auth", "request"]) {
      expect(context).not.toHaveProperty(key);
    }
  });
});
