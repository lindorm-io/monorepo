import { Metric } from "@lindorm-io/koa";
import { createMockLogger } from "@lindorm-io/winston";
import { eventSourceMiddleware } from "./event-source-middleware";

const next = () => Promise.resolve();
const spyPublish = jest.fn();

class EventSource {
  constructor() {}
  public get isInitialised(): boolean {
    return true;
  }
  public publish(...args: any): string {
    spyPublish(...args);
    return "publish";
  }
  public get admin(): string {
    return "admin";
  }
  public get repositories(): string {
    return "repositories";
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
      metadata: { identifiers: { correlationId: "correlationId" } },
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should set app on context", async () => {
    await expect(eventSourceMiddleware(app)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.eventSource.publish({ options: true })).toStrictEqual("publish");
    expect(ctx.eventSource.admin).toStrictEqual("admin");
    expect(ctx.eventSource.repositories).toStrictEqual("repositories");
    expect(ctx.metrics.mongo).toStrictEqual(expect.any(Number));

    expect(spyPublish).toHaveBeenCalledWith({
      correlationId: "correlationId",
      options: true,
    });
  });
});
