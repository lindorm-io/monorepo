import { Metric } from "@lindorm-io/koa";
import { createMockLogger } from "@lindorm-io/winston";
import { mongoMiddleware } from "./mongo-middleware";

const next = () => Promise.resolve();

const connect = jest.fn();

class MongoConnection {
  constructor() {}
  async connect() {
    connect();
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

  test("should wait for connection and set on context", async () => {
    await expect(mongoMiddleware(connection)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.connection.mongo).toStrictEqual(expect.any(MongoConnection));
    expect(connect).toHaveBeenCalled();
    expect(ctx.metrics.mongo).toStrictEqual(expect.any(Number));
  });
});
