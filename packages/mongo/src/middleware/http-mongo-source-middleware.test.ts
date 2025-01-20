import { createMockLogger } from "@lindorm/logger";
import { IMongoSource } from "../interfaces";
import { createHttpMongoSourceMiddleware } from "./http-mongo-source-middleware";

describe("createHttpMongoSourceMiddleware", () => {
  const next = jest.fn();

  let ctx: any;
  let source: IMongoSource;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
    };
    source = { clone: () => ({ clonedSource: true }) } as any;
  });

  test("should set source on context", async () => {
    await expect(
      createHttpMongoSourceMiddleware(source)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.sources.mongo).toEqual({ clonedSource: true });
  });
});
