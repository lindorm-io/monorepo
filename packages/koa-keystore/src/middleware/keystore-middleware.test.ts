import { Metric } from "@lindorm-io/koa";
import { getTestKeyPairEC, getTestKeyPairRSA, logger } from "../test";
import { keystoreMiddleware } from "./keystore-middleware";
import { Keystore } from "@lindorm-io/key-pair";

const next = () => Promise.resolve();

describe("keystoreMiddleware", () => {
  const keyEC = getTestKeyPairEC();
  const keyRSA = getTestKeyPairRSA();

  let ctx: any;

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
