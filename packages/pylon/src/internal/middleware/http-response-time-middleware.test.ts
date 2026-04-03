import MockDate from "mockdate";
import { httpResponseTimeMiddleware } from "./http-response-time-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("httpResponseTimeMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      set: jest.fn(),
    };
  });

  test("should calculate response time and set on header", async () => {
    const next = async () => {
      MockDate.set("2024-01-01T08:01:23.456Z");
    };

    await expect(httpResponseTimeMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.set).toHaveBeenCalledWith("date", "Mon, 01 Jan 2024 08:01:23 GMT");
    expect(ctx.set).toHaveBeenCalledWith("x-start-time", "1704096000000");
    expect(ctx.set).toHaveBeenCalledWith("x-current-time", "1704096083456");
    expect(ctx.set).toHaveBeenCalledWith("x-response-time", "83456ms");
  });
});
