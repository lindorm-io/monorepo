import { Metric } from "@lindorm-io/koa";
import { cacheKeysMiddleware } from "./cache-keys-middleware";
import { createTestKeyPairEC, createTestKeyPairRSA } from "@lindorm-io/key-pair";
import { createMockLogger } from "@lindorm-io/winston";
import { createMockCache } from "@lindorm-io/redis";

const next = () => Promise.resolve();

describe("cacheKeysMiddleware", () => {
  let ctx: any;

  const logger = createMockLogger();
  const keyEC = createTestKeyPairEC();
  const keyRSA = createTestKeyPairRSA();

  beforeEach(async () => {
    ctx = {
      cache: {
        keyPairCache: createMockCache(() => keyRSA),
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
