import { Metric } from "@lindorm-io/koa";
import { logger } from "../test";
import { mongoMiddleware } from "./mongo-middleware";

const next = () => Promise.resolve();

const waitForConnection = jest.fn();

class MongoConnection {
  constructor() {}
  async waitForConnection() {
    waitForConnection();
  }
}

describe("mongoMiddleware", () => {
  let ctx: any;
  let connection: any;

  beforeEach(async () => {
    connection = new MongoConnection();

    ctx = {
      connection: {},
      logger,
      metrics: {},
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should wait for connection and set on context", async () => {
    await expect(mongoMiddleware(connection)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.connection.mongo).toStrictEqual(expect.any(MongoConnection));
    expect(waitForConnection).toHaveBeenCalled();
    expect(ctx.metrics.mongo).toStrictEqual(expect.any(Number));
  });
});
