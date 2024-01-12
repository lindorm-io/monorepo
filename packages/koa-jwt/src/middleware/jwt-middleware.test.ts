import { createMockLogger } from "@lindorm-io/core-logger";
import { ServerError } from "@lindorm-io/errors";
import { JWT } from "@lindorm-io/jwt";
import { createTestKeystore } from "@lindorm-io/keystore";
import { Metric } from "@lindorm-io/koa";
import MockDate from "mockdate";
import { jwtMiddleware } from "./jwt-middleware";

MockDate.set("2021-01-01T08:00:00.000Z");

const next = () => Promise.resolve();

describe("jwtMiddleware", () => {
  let ctx: any;
  let options: any;

  const logger = createMockLogger();

  beforeEach(() => {
    options = {
      issuer: "issuer",
    };

    ctx = {
      keystore: createTestKeystore(),
      metrics: {},
      logger,
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should set issuer on context", async () => {
    await expect(jwtMiddleware(options)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.jwt).toStrictEqual(expect.any(JWT));
    expect(ctx.metrics.jwt).toStrictEqual(expect.any(Number));
  });

  test("should throw InvalidKeystoreError", async () => {
    ctx.keystore = undefined;

    await expect(jwtMiddleware(options)(ctx, next)).rejects.toThrow(ServerError);
  });
});
