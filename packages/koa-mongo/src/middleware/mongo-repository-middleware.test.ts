import { Metric } from "@lindorm-io/koa";
import { createMockMongoConnection, TestMongoRepository } from "@lindorm-io/mongo";
import { createMockLogger } from "@lindorm-io/core-logger";
import { mongoRepositoryMiddleware } from "./mongo-repository-middleware";

const next = () => Promise.resolve();

describe("repositoryMiddleware", () => {
  let ctx: any;

  const connection = createMockMongoConnection();
  const logger = createMockLogger();

  beforeEach(() => {
    ctx = {
      logger,
      metrics: {},
      mongo: {},
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should set repository on context", async () => {
    await expect(
      mongoRepositoryMiddleware(connection, TestMongoRepository)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.mongo.testMongoRepository).toStrictEqual(expect.any(TestMongoRepository));
    expect(ctx.metrics.mongo).toStrictEqual(expect.any(Number));
  });

  test("should set repository with specific key", async () => {
    await expect(
      mongoRepositoryMiddleware(connection, TestMongoRepository, { repositoryKey: "otherKey" })(
        ctx,
        next,
      ),
    ).resolves.toBeUndefined();

    expect(ctx.mongo.otherKey).toStrictEqual(expect.any(TestMongoRepository));
    expect(ctx.metrics.mongo).toStrictEqual(expect.any(Number));
  });
});
