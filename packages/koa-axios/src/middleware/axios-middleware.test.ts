import MockDate from "mockdate";
import { Axios, Middleware } from "@lindorm-io/axios";
import { MetadataHeader } from "@lindorm-io/koa";
import { axiosMiddleware } from "./axios-middleware";
import { createMockLogger } from "@lindorm-io/core-logger";

MockDate.set("2020-01-01T08:00:00.000Z");

const next = jest.fn();

describe("axiosMiddleware", () => {
  let options: any;
  let ctx: any;

  const logger = createMockLogger();

  beforeEach(() => {
    const mw: Middleware = async (ctx, next) => {
      await next();
    };

    options = {
      host: "https://lindorm.io",
      port: 4000,
      middleware: [mw],
      clientName: "axiosClient",
    };

    ctx = {
      axios: {},
      logger,
      metadata: { correlationId: "6be482f0-943b-4b64-8c9c-4c7f2efcf50c" },
      getMetadataHeaders: () => ({
        [MetadataHeader.CORRELATION_ID]: "6be482f0-943b-4b64-8c9c-4c7f2efcf50c",
      }),
      metrics: {},
      token: { bearerToken: { token: "jwt.jwt.jwt" } },
    };
  });

  test("should create axios client on context", async () => {
    await expect(axiosMiddleware(options)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient).toStrictEqual(expect.any(Axios));
    expect(ctx.axios.axiosClient.host).toBe("lindorm.io");
    expect(ctx.axios.axiosClient.port).toBe(4000);
    expect(ctx.axios.axiosClient.protocol).toBe("https");
    expect(ctx.axios.axiosClient.middleware.length).toBe(2);
    expect(ctx.metrics.axios).toBe(0);
  });
});
