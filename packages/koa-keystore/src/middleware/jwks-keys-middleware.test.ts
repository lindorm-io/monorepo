import { Metric } from "@lindorm-io/koa";
import { createTestKeyPairEC, createTestKeyPairRSA } from "@lindorm-io/key-pair";
import { createMockLogger } from "@lindorm-io/winston";
import { jwksKeysMiddleware } from "./jwks-keys-middleware";

const keyRSA = createTestKeyPairRSA();

jest.mock("../class", () => ({
  WebKeyHandler: class WebKeyHandler {
    public async getKeys() {
      return [keyRSA];
    }
  },
}));

const next = () => Promise.resolve();

describe("jwksKeysMiddleware", () => {
  let ctx: any;

  const keyEC = createTestKeyPairEC();
  const logger = createMockLogger();

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
        host: "https://lindorm.io",
        name: "clientName",
        port: 4000,
      })(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.keys).toStrictEqual([keyEC, keyRSA]);
    expect(ctx.metrics.keystore).toStrictEqual(expect.any(Number));
  });
});
