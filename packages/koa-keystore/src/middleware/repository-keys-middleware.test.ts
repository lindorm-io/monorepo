import { Metric } from "@lindorm-io/koa";
import { createTestKeyPairEC, createTestKeyPairRSA } from "@lindorm-io/key-pair";
import { createMockLogger } from "@lindorm-io/winston";
import { createMockRepository } from "@lindorm-io/mongo";
import { repositoryKeysMiddleware } from "./repository-keys-middleware";

const next = () => Promise.resolve();

describe("repositoryKeysMiddleware", () => {
  let ctx: any;

  const logger = createMockLogger();
  const keyEC = createTestKeyPairEC();
  const keyRSA = createTestKeyPairRSA();

  beforeEach(async () => {
    ctx = {
      keys: [keyEC],
      logger,
      metrics: {},
      repository: {
        keyPairRepository: createMockRepository(() => keyRSA),
      },
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should successfully add keys to context", async () => {
    await expect(repositoryKeysMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.keys).toStrictEqual([keyEC, keyRSA]);
    expect(ctx.metrics.keystore).toStrictEqual(expect.any(Number));
  });
});
