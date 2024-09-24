import { IMongoSource } from "../interfaces";
import { createHttpMongoSourceMiddleware } from "./http-mongo-source-middleware";

describe("createHttpMongoSourceMiddleware", () => {
  const next = jest.fn();

  let ctx: any;
  let source: IMongoSource;

  beforeEach(() => {
    ctx = { logger: "logger" };
    source = { clone: () => ({ clonedSource: true }) } as any;
  });

  test("should set source on context", async () => {
    await expect(
      createHttpMongoSourceMiddleware(source)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.mongo).toEqual({ clonedSource: true });
  });
});
