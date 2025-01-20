import { createMockLogger } from "@lindorm/logger";
import { IRedisSource } from "../interfaces";
import { createHttpRedisSourceMiddleware } from "./http-redis-source-middleware";

describe("createHttpRedisSourceMiddleware", () => {
  const next = jest.fn();

  let ctx: any;
  let source: IRedisSource;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
    };
    source = { clone: () => ({ clonedSource: true }) } as any;
  });

  test("should set source on context", async () => {
    await expect(
      createHttpRedisSourceMiddleware(source)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.sources.redis).toEqual({ clonedSource: true });
  });
});
