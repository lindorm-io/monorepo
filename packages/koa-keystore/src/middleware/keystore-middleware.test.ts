import { Metric } from "@lindorm-io/koa";
import { createTestKeyPairEC, createTestKeyPairRSA, Keystore } from "@lindorm-io/key-pair";
import { createMockLogger } from "@lindorm-io/core-logger";
import { keystoreMiddleware } from "./keystore-middleware";

const next = () => Promise.resolve();

describe("keystoreMiddleware", () => {
  let ctx: any;

  const logger = createMockLogger();
  const keyEC = createTestKeyPairEC();
  const keyRSA = createTestKeyPairRSA();

  beforeEach(() => {
    ctx = {
      keys: [keyEC, keyRSA],
      logger,
      metrics: {},
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should successfully set keystore on context", async () => {
    await expect(keystoreMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.keystore).toStrictEqual(expect.any(Keystore));
    expect(ctx.keystore.getKeys()).toStrictEqual([keyEC, keyRSA]);
    expect(ctx.metrics.keystore).toStrictEqual(expect.any(Number));
  });
});
