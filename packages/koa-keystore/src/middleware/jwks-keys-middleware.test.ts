import { createMockLogger } from "@lindorm-io/core-logger";
import { createTestStoredKeySetEc, createTestStoredKeySetRsa } from "@lindorm-io/keystore";
import { Metric } from "@lindorm-io/koa";
import { getKeysFromJwks as _getKeysFromJwks } from "../utils";
import { jwksKeysMiddleware } from "./jwks-keys-middleware";

jest.mock("../utils");

const next = () => Promise.resolve();

const getKeysFromJwks = _getKeysFromJwks as jest.Mock;

describe("jwksKeysMiddleware", () => {
  let ctx: any;

  const keyEC = createTestStoredKeySetEc();
  const keyRSA = createTestStoredKeySetRsa();
  const logger = createMockLogger();

  beforeEach(async () => {
    ctx = {
      keys: [keyEC.webKeySet],
      logger,
      metrics: {},
    };

    ctx.getMetric = (key: string) => new Metric(ctx, key);

    getKeysFromJwks.mockResolvedValue([keyRSA.webKeySet]);
  });

  test("should successfully add keys to context", async () => {
    await expect(
      jwksKeysMiddleware({
        alias: "alias",
        client: { name: "client" },
        host: "https://lindorm.io",
        port: 4000,
      })(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.keys).toStrictEqual([keyEC.webKeySet, keyRSA.webKeySet]);
    expect(ctx.metrics.keystore).toStrictEqual(expect.any(Number));
  });
});
