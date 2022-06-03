import { Keystore } from "@lindorm-io/key-pair";
import { Metric } from "@lindorm-io/koa";
import { createMockLogger } from "@lindorm-io/winston";
import { getTestKeyPairEC, getTestKeyPairRSA } from "../test";
import { keystoreMiddleware } from "./keystore-middleware";

const next = () => Promise.resolve();

describe("keystoreMiddleware", () => {
  let ctx: any;

  const logger = createMockLogger();
  const keyEC = getTestKeyPairEC();
  const keyRSA = getTestKeyPairRSA();

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
