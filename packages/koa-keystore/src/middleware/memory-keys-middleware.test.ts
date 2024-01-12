import { createMockLogger } from "@lindorm-io/core-logger";
import { createMockMemoryCache } from "@lindorm-io/in-memory-cache";
import { createTestStoredKeySetEc, createTestStoredKeySetRsa } from "@lindorm-io/keystore";
import { Metric } from "@lindorm-io/koa";
import { memoryKeysMiddleware } from "./memory-keys-middleware";

const next = () => Promise.resolve();

describe("memoryKeysMiddleware", () => {
  let ctx: any;

  const logger = createMockLogger();
  const keyEC = createTestStoredKeySetEc();
  const keyRSA = createTestStoredKeySetRsa();

  beforeEach(async () => {
    ctx = {
      memory: {
        storedKeySetMemoryCache: createMockMemoryCache(() => keyRSA),
      },
      keys: [keyEC.webKeySet],
      logger,
      metrics: {},
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should successfully add keys to context", async () => {
    await expect(memoryKeysMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.keys).toStrictEqual([keyEC.webKeySet, keyRSA.webKeySet]);
    expect(ctx.metrics.keystore).toStrictEqual(expect.any(Number));
  });
});
