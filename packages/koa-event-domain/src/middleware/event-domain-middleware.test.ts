import { Metric } from "@lindorm-io/koa";
import { createMockLogger } from "@lindorm-io/winston";
import { eventDomainMiddleware } from "./event-domain-middleware";

const next = () => Promise.resolve();

class EventDomainApp {
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
    app = new EventDomainApp();

    ctx = {
      logger,
      metrics: {},
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should set app on context", async () => {
    await expect(eventDomainMiddleware(app)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.eventDomain).toStrictEqual(expect.any(EventDomainApp));
    expect(ctx.metrics.mongo).toStrictEqual(expect.any(Number));
  });
});
