import { Metric } from "@lindorm-io/koa";
import { amqpMiddleware } from "./amqp-middleware";
import { createMockLogger } from "@lindorm-io/winston";

const next = () => Promise.resolve();

const connect = jest.fn();

class AmqpConnection {
  constructor() {}
  async connect() {
    connect();
  }
}

describe("amqpMiddleware", () => {
  let ctx: any;
  let connection: any;

  const logger = createMockLogger();

  beforeEach(async () => {
    connection = new AmqpConnection();

    ctx = {
      connection: {},
      logger,
      metrics: {},
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should wait for connection and set on context", async () => {
    await expect(amqpMiddleware(connection)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.connection.amqp).toStrictEqual(expect.any(AmqpConnection));
    expect(connect).toHaveBeenCalled();
    expect(ctx.metrics.amqp).toStrictEqual(expect.any(Number));
  });
});
