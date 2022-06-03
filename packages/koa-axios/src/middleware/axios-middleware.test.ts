import MockDate from "mockdate";
import { Axios } from "@lindorm-io/axios";
import { MetadataHeader } from "@lindorm-io/koa";
import { axiosMiddleware } from "./axios-middleware";
import { createMockLogger } from "@lindorm-io/winston";

MockDate.set("2020-01-01T08:00:00.000Z");

const next = jest.fn();

describe("axiosMiddleware", () => {
  let options: any;
  let ctx: any;

  const logger = createMockLogger();

  beforeEach(() => {
    options = {
      host: "https://lindorm.io",
      port: 4000,
      middleware: [{ request: jest.fn().mockResolvedValue({}) }],
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
    expect(ctx.axios.axiosClient.host).toBe("https://lindorm.io");
    expect(ctx.axios.axiosClient.port).toBe(4000);
    expect(ctx.axios.axiosClient.middleware.length).toBe(2);
    expect(ctx.metrics.axios).toBe(0);
  });
});
