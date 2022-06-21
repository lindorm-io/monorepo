import { Metric } from "@lindorm-io/koa";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestKeyPairEC, createTestKeyPairRSA } from "@lindorm-io/key-pair";
import { getKeysFromJwks as _getKeysFromJwks } from "../util";
import { jwksKeysMiddleware } from "./jwks-keys-middleware";

jest.mock("../util");

const next = () => Promise.resolve();

const getKeysFromJwks = _getKeysFromJwks as jest.Mock;

describe("jwksKeysMiddleware", () => {
  let ctx: any;

  const keyEC = createTestKeyPairEC();
  const keyRSA = createTestKeyPairRSA();
  const logger = createMockLogger();

  beforeEach(async () => {
    ctx = {
      keys: [keyEC],
      logger,
      metrics: {},
    };

    ctx.getMetric = (key: string) => new Metric(ctx, key);

    getKeysFromJwks.mockResolvedValue([keyEC, keyRSA]);
  });

  test("should successfully add keys to context", async () => {
    await expect(
      jwksKeysMiddleware({
        host: "https://lindorm.io",
        name: "clientName",
        port: 4000,
      })(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.keys).toStrictEqual([keyEC, keyRSA]);
    expect(ctx.metrics.keystore).toStrictEqual(expect.any(Number));
  });
});
