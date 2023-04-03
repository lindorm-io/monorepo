import { Metric } from "@lindorm-io/koa";
import { createMockAmqpConnection, TestMessageBus } from "@lindorm-io/amqp";
import { createMockLogger } from "@lindorm-io/core-logger";
import { messageBusMiddleware } from "./message-bus-middleware";

const next = () => Promise.resolve();

describe("messageBusMiddleware", () => {
  let ctx: any;

  const connection = createMockAmqpConnection();
  const logger = createMockLogger();

  beforeEach(() => {
    ctx = {
      logger,
      metrics: {},
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should set messageBus on context", async () => {
    await expect(
      messageBusMiddleware(connection, TestMessageBus)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.messageBus).toStrictEqual(expect.any(TestMessageBus));
    expect(ctx.metrics.amqp).toStrictEqual(expect.any(Number));
  });
});
