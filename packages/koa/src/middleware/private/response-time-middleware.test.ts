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
      set: jest.fn(),
    };
  });

  test("should resolve with headers", async () => {
    await expect(responseTimeMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.set.mock.calls[0]).toEqual(["X-Start-Time", "1577865600000"]);
    expect(ctx.set.mock.calls[1]).toEqual(["X-Current-Time", "1577865683456"]);
    expect(ctx.set.mock.calls[2]).toEqual(["X-Response-Time", "83456ms"]);
  });
});
