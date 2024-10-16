import { HttpMethod } from "@lindorm/enums";
import { createHttpCorsMiddleware } from "./http-cors-middleware";

describe("httpCorsMiddleware", () => {
  const next = jest.fn();

  let ctx: any;

  beforeEach(() => {
    ctx = {
      set: jest.fn(),
    };
  });

  test("should resolve arrays", async () => {
    await expect(
      createHttpCorsMiddleware({
        allowCredentials: true,
        allowHeaders: ["allowed-header-1", "allowed-header-2"],
        allowMethods: [HttpMethod.Get, HttpMethod.Post, HttpMethod.Options],
        allowOrigins: ["http://localhost:3000", "http://localhost:3001"],
        exposeHeaders: ["exposed-header-1", "exposed-header-2"],
        maxAge: "1d",
      })(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.set).toHaveBeenNthCalledWith(
      1,
      "Access-Control-Allow-Credentials",
      "true",
    );
    expect(ctx.set).toHaveBeenNthCalledWith(
      2,
      "Access-Control-Allow-Headers",
      "allowed-header-1,allowed-header-2",
    );
    expect(ctx.set).toHaveBeenNthCalledWith(
      3,
      "Access-Control-Allow-Methods",
      "GET,POST,OPTIONS",
    );
    expect(ctx.set).toHaveBeenNthCalledWith(
      4,
      "Access-Control-Allow-Origin",
      "http://localhost:3000,http://localhost:3001",
    );
    expect(ctx.set).toHaveBeenNthCalledWith(
      5,
      "Access-Control-Expose-Headers",
      "exposed-header-1,exposed-header-2",
    );
    expect(ctx.set).toHaveBeenNthCalledWith(6, "Access-Control-Max-Age", "86400");
  });

  test("should resolve strings", async () => {
    await expect(
      createHttpCorsMiddleware({
        allowHeaders: "*",
        allowMethods: "*",
        allowOrigins: "*",
        exposeHeaders: "*",
      })(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.set).toHaveBeenNthCalledWith(1, "Access-Control-Allow-Headers", "*");
    expect(ctx.set).toHaveBeenNthCalledWith(2, "Access-Control-Allow-Methods", "*");
    expect(ctx.set).toHaveBeenNthCalledWith(3, "Access-Control-Allow-Origin", "*");
    expect(ctx.set).toHaveBeenNthCalledWith(4, "Access-Control-Expose-Headers", "*");
  });
});
