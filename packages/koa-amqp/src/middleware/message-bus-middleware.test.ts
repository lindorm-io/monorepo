import { Metric } from "@lindorm-io/koa";
import { createMockAmqpConnection, TestMessageBus } from "@lindorm-io/amqp";
import { createMockLogger } from "@lindorm-io/winston";
import { messageBusMiddleware } from "./message-bus-middleware";

const next = () => Promise.resolve();

describe("messageBusMiddleware", () => {
  let ctx: any;

  const logger = createMockLogger();

  beforeEach(() => {
    ctx = {
      connection: { amqp: createMockAmqpConnection() },
      logger,
      metrics: {},
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should set messageBus on context", async () => {
    await expect(messageBusMiddleware(TestMessageBus)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.messageBus).toStrictEqual(expect.any(TestMessageBus));
    expect(ctx.metrics.amqp).toStrictEqual(expect.any(Number));
  });
});
