import { createMockLogger } from "@lindorm/logger";
import { IRedisSource } from "../interfaces";
import { createSocketRedisSourceMiddleware } from "./socket-redis-source-middleware";

describe("createSocketRedisSourceMiddleware", () => {
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
      createSocketRedisSourceMiddleware(source)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.sources.redis).toEqual({ clonedSource: true });
  });
});
