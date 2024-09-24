import { IRedisSource } from "../interfaces";
import { createSocketRedisSourceMiddleware } from "./socket-redis-source-middleware";

describe("createSocketRedisSourceMiddleware", () => {
  const next = jest.fn();

  let ctx: any;
  let source: IRedisSource;

  beforeEach(() => {
    ctx = { logger: "logger" };
    source = { clone: () => ({ clonedSource: true }) } as any;
  });

  test("should set source on context", async () => {
    await expect(
      createSocketRedisSourceMiddleware(source)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.redis).toEqual({ clonedSource: true });
  });
});
