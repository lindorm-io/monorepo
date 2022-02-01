import { Metric } from "@lindorm-io/koa";
import { cacheKeysMiddleware } from "./cache-keys-middleware";
import { getTestKeyPairEC, getTestKeyPairRSA, logger } from "../test";

const next = () => Promise.resolve();

describe("cacheKeysMiddleware", () => {
  const keyEC = getTestKeyPairEC();
  const keyRSA = getTestKeyPairRSA();

  let ctx: any;

  beforeEach(async () => {
    ctx = {
      cache: {
        keyPairCache: {
          findMany: jest.fn().mockResolvedValue([keyRSA]),
        },
      },
      keys: [keyEC],
      logger,
      metrics: {},
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should successfully add keys to context", async () => {
    await expect(cacheKeysMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.keys).toStrictEqual([keyEC, keyRSA]);
    expect(ctx.metrics.keystore).toStrictEqual(expect.any(Number));
  });
});
