import { Metric } from "@lindorm-io/koa";
import { getTestKeyPairEC, getTestKeyPairRSA, logger } from "../test";
import { jwksKeysMiddleware } from "./jwks-keys-middleware";

const keyRSA = getTestKeyPairRSA();

jest.mock("../class", () => ({
  WebKeyHandler: class WebKeyHandler {
    public async getKeys() {
      return [keyRSA];
    }
  },
}));

const next = () => Promise.resolve();

describe("jwksKeysMiddleware", () => {
  const keyEC = getTestKeyPairEC();

  let ctx: any;

  beforeEach(async () => {
    ctx = {
      keys: [keyEC],
      logger,
      metrics: {},
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should successfully add keys to context", async () => {
    await expect(
      jwksKeysMiddleware({
        baseUrl: "baseUrl",
        clientName: "clientName",
      })(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.keys).toStrictEqual([keyEC, keyRSA]);
    expect(ctx.metrics.keystore).toStrictEqual(expect.any(Number));
  });
});
