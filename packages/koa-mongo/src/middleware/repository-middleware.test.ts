import { Metric } from "@lindorm-io/koa";
import { logger, TestRepository } from "../test";
import { repositoryMiddleware } from "./repository-middleware";

const next = () => Promise.resolve();

describe("repositoryMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      connection: { mongo: { database: () => "db" } },
      logger,
      metrics: {},
      repository: {},
    };
    ctx.getMetric = (key: string) => new Metric(ctx, key);
  });

  test("should set repository on context", async () => {
    await expect(repositoryMiddleware(TestRepository)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.repository.testRepository).toStrictEqual(expect.any(TestRepository));
    expect(ctx.metrics.mongo).toStrictEqual(expect.any(Number));
  });

  test("should set repository with specific key", async () => {
    await expect(
      repositoryMiddleware(TestRepository, { repositoryKey: "otherKey" })(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.repository.otherKey).toStrictEqual(expect.any(TestRepository));
    expect(ctx.metrics.mongo).toStrictEqual(expect.any(Number));
  });
});
