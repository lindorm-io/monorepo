import { Metric } from "@lindorm-io/koa";
import { redisKeysMiddleware } from "./redis-keys-middleware";
import { createTestKeyPairEC, createTestKeyPairRSA } from "@lindorm-io/key-pair";
import { createMockLogger } from "@lindorm-io/core-logger";
import { createMockRedisRepository } from "@lindorm-io/redis";

const next = () => Promise.resolve();

describe("cacheKeysMiddleware", () => {
  let ctx: any;

  const logger = createMockLogger();
  const keyEC = createTestKeyPairEC();
  const keyRSA = createTestKeyPairRSA();

  beforeEach(async () => {
    ctx = {
      keys: [keyEC],
      logger,
      metrics: {},
      redis: {
        keyPairRedisRepository: createMockRedisRepository(() => keyRSA),
      },
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should successfully add keys to context", async () => {
    await expect(redisKeysMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.keys).toStrictEqual([keyEC, keyRSA]);
    expect(ctx.metrics.keystore).toStrictEqual(expect.any(Number));
  });
});
