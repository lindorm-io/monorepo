import MockDate from "mockdate";
import { responseTimeMiddleware } from "./response-time-middleware";

MockDate.set("2020-01-01T08:00:00.000Z");

const next = async () => {
  MockDate.set("2020-01-01T08:01:23.456Z");
};

describe("responseTimeMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      getMetric: jest.fn(() => ({ end: jest.fn() })),
      metrics: { responseTime: 100 },
      set: jest.fn(),
    };
  });

  test("should resolve with headers", async () => {
    await expect(responseTimeMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.set.mock.calls[0]).toEqual(["x-start-time", "1577865600000"]);
    expect(ctx.set.mock.calls[1]).toEqual(["x-current-time", "1577865683456"]);
    expect(ctx.set.mock.calls[2]).toEqual(["x-response-time", "100ms"]);
  });
});
