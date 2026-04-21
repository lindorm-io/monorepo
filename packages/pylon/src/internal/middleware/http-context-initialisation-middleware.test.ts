import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createHttpContextInitialisationMiddleware } from "./http-context-initialisation-middleware";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("createHttpContextInitialisationMiddleware", () => {
  let ctx: any;
  let logger: any;

  beforeEach(() => {
    logger = createMockLogger();

    ctx = {
      state: {
        metadata: {
          correlationId: "8b39eafc-7e31-501b-ab7b-58514b14856a",
          id: "aa9a627d-8296-598c-9589-4ec91d27d056",
          responseId: "ee576e4a-c30c-5138-bfa8-51ca832bdaec",
        },
      },
    };
  });

  test("should initialise context defaults", async () => {
    await expect(
      createHttpContextInitialisationMiddleware(logger)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.body).toEqual({});
    expect(ctx.status).toEqual(404);
    expect(ctx.files).toEqual([]);
    expect(ctx.logger).toEqual(expect.any(Object));
  });

  test("should create child logger with request metadata", async () => {
    await createHttpContextInitialisationMiddleware(logger)(ctx, vi.fn());

    expect(logger.child).toHaveBeenCalledWith(["Request"], {
      correlationId: "8b39eafc-7e31-501b-ab7b-58514b14856a",
      requestId: "aa9a627d-8296-598c-9589-4ec91d27d056",
      responseId: "ee576e4a-c30c-5138-bfa8-51ca832bdaec",
    });
  });

  test("should call next", async () => {
    const next = vi.fn();

    await createHttpContextInitialisationMiddleware(logger)(ctx, next);

    expect(next).toHaveBeenCalled();
  });
});
