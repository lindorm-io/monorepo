import { Metric } from "@lindorm-io/koa";
import { logger } from "../test";
import { redisMiddleware } from "./redis-middleware";

const next = () => Promise.resolve();

const waitForConnection = jest.fn();

class RedisConnection {
  constructor() {}
  async waitForConnection() {
    waitForConnection();
  }
}

describe("redisMiddleware", () => {
  let ctx: any;
  let connection: any;

  beforeEach(async () => {
    connection = new RedisConnection();

    ctx = {
      connection: {},
      logger,
      metrics: {},
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should wait for connection and set on context", async () => {
    await expect(redisMiddleware(connection)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.connection.redis).toStrictEqual(expect.any(RedisConnection));
    expect(waitForConnection).toHaveBeenCalled();
    expect(ctx.metrics.redis).toStrictEqual(expect.any(Number));
  });
});
