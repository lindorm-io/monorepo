import { Metric } from "@lindorm-io/koa";
import { createMockLogger } from "@lindorm-io/core-logger";
import { mongoConnectionMiddleware } from "./mongo-connection-middleware";

const next = () => Promise.resolve();

class MongoConnection {
  constructor() {}
  public get isConnected(): boolean {
    return true;
  }
}

describe("mongoMiddleware", () => {
  let ctx: any;
  let connection: any;

  const logger = createMockLogger();

  beforeEach(async () => {
    connection = new MongoConnection();

    ctx = {
      connection: {},
      logger,
      metrics: {},
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should set connection on context", async () => {
    await expect(mongoConnectionMiddleware(connection)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.connection.mongo).toStrictEqual(expect.any(MongoConnection));
    expect(ctx.metrics.mongo).toStrictEqual(expect.any(Number));
  });
});
