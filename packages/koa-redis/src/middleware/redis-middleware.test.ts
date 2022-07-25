import { Metric } from "@lindorm-io/koa";
import { createMockLogger } from "@lindorm-io/winston";
import { redisMiddleware } from "./redis-middleware";

const next = () => Promise.resolve();

class RedisConnection {
  constructor() {}
  public get isConnected(): boolean {
    return true;
  }
}

describe("redisMiddleware", () => {
  let ctx: any;
  let connection: any;

  const logger = createMockLogger();

  beforeEach(async () => {
    connection = new RedisConnection();

    ctx = {
      connection: {},
      logger,
      metrics: {},
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should set connection on context", async () => {
    await expect(redisMiddleware(connection)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.connection.redis).toStrictEqual(expect.any(RedisConnection));
    expect(ctx.metrics.redis).toStrictEqual(expect.any(Number));
  });
});
