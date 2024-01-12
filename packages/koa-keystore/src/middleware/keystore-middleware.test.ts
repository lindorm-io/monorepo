import { createMockLogger } from "@lindorm-io/core-logger";
import {
  createTestStoredKeySetEc,
  createTestStoredKeySetRsa,
  Keystore,
} from "@lindorm-io/keystore";
import { Metric } from "@lindorm-io/koa";
import { keystoreMiddleware } from "./keystore-middleware";

const next = () => Promise.resolve();

describe("keystoreMiddleware", () => {
  let ctx: any;

  const logger = createMockLogger();
  const keyEC = createTestStoredKeySetEc();
  const keyRSA = createTestStoredKeySetRsa();

  beforeEach(() => {
    ctx = {
      keys: [keyEC.webKeySet, keyRSA.webKeySet],
      logger,
      metrics: {},
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should successfully set keystore on context", async () => {
    await expect(keystoreMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.keystore).toStrictEqual(expect.any(Keystore));
    expect(ctx.keystore.allKeys).toStrictEqual([keyEC.webKeySet, keyRSA.webKeySet]);
    expect(ctx.metrics.keystore).toStrictEqual(expect.any(Number));
  });
});
