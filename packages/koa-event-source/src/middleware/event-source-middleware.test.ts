import { Metric } from "@lindorm-io/koa";
import { createMockLogger } from "@lindorm-io/core-logger";
import { eventSourceMiddleware } from "./event-source-middleware";

const next = () => Promise.resolve();
const spyPublish = jest.fn();
const spyQuery = jest.fn();

class EventSource {
  constructor() {}
  public get isInitialised(): boolean {
    return true;
  }
  public command(...args: any): string {
    spyPublish(...args);
    return "command";
  }
  public query(...args: any): string {
    spyQuery(...args);
    return "query";
  }
  public get admin(): string {
    return "admin";
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
      token: {
        bearerToken: { subject: "subject" },
      },
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should set app on context", async () => {
    await expect(eventSourceMiddleware(app)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.eventSource.command({ options: true })).toStrictEqual("command");
    expect(ctx.eventSource.query({ options: true })).toStrictEqual("query");
    expect(ctx.eventSource.admin).toStrictEqual("admin");

    expect(ctx.metrics.eventSource).toStrictEqual(expect.any(Number));

    expect(spyPublish).toHaveBeenCalledWith(
      {
        options: true,
      },
      {
        correlationId: "correlationId",
        metadata: {
          subject: "subject",
          trace: "identity",
        },
      },
    );
    expect(spyQuery).toHaveBeenCalledWith({
      options: true,
    });
  });
});
