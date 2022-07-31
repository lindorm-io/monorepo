import { Metric } from "@lindorm-io/koa";
import { createMockLogger } from "@lindorm-io/winston";
import { eventSourceMiddleware } from "./event-source-middleware";

const next = () => Promise.resolve();

class EventSource {
  constructor() {}
  public get isInitialised(): boolean {
    return true;
  }
}

describe("mongoMiddleware", () => {
  let ctx: any;
  let app: any;

  const logger = createMockLogger();

  beforeEach(async () => {
    app = new EventSource();

    ctx = {
      logger,
      metrics: {},
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should set app on context", async () => {
    await expect(eventSourceMiddleware(app)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.eventSource).toStrictEqual(expect.any(EventSource));
    expect(ctx.metrics.mongo).toStrictEqual(expect.any(Number));
  });
});
