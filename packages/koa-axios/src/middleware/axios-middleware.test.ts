import { Axios, Middleware } from "@lindorm-io/axios";
import { createMockLogger } from "@lindorm-io/core-logger";
import MockDate from "mockdate";
import { AxiosMiddlewareConfig } from "../types";
import { axiosMiddleware } from "./axios-middleware";

MockDate.set("2020-01-01T08:00:00.000Z");

const next = jest.fn();

describe("axiosMiddleware", () => {
  let config: AxiosMiddlewareConfig;
  let ctx: any;

  const logger = createMockLogger();

  beforeEach(() => {
    const mw: Middleware = async (ctx, next) => {
      await next();
    };

    config = {
      alias: "axiosClient",

      host: "https://lindorm.io",
      port: 4000,
      middleware: [mw],
    };

    ctx = {
      axios: {},
      logger,
      metadata: {
        device: {
          installationId: "installationId",
          ip: "ip",
          linkId: "linkId",
          name: "name",
          systemVersion: "systemVersion",
          uniqueId: "uniqueId",
        },
        identifiers: {
          correlationId: "correlationId",
        },
      },
      metrics: {},
      server: {
        environment: "environment",
      },
    };
  });

  test("should create axios client on context", async () => {
    await expect(axiosMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.axios.axiosClient).toStrictEqual(expect.any(Axios));
    expect(ctx.metrics.axios).toBe(0);
  });
});
