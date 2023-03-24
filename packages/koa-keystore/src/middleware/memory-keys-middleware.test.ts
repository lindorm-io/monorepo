import { Metric } from "@lindorm-io/koa";
import { memoryKeysMiddleware } from "./memory-keys-middleware";
import { createMockLogger } from "@lindorm-io/core-logger";
import { createMockMemoryCache } from "@lindorm-io/in-memory-cache";
import { createTestKeyPairEC, createTestKeyPairRSA } from "@lindorm-io/key-pair";

const next = () => Promise.resolve();

describe("memoryKeysMiddleware", () => {
  let ctx: any;

  const logger = createMockLogger();
  const keyEC = createTestKeyPairEC();
  const keyRSA = createTestKeyPairRSA();

  beforeEach(async () => {
    ctx = {
      memory: {
        keyPairMemoryCache: createMockMemoryCache(() => keyRSA),
      },
      keys: [keyEC],
      logger,
      metrics: {},
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should successfully add keys to context", async () => {
    await expect(memoryKeysMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.keys).toStrictEqual([keyEC, keyRSA]);
    expect(ctx.metrics.keystore).toStrictEqual(expect.any(Number));
  });
});
