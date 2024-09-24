import { IMongoSource } from "../interfaces";
import { createSocketMongoSourceMiddleware } from "./socket-mongo-source-middleware";

describe("createSocketMongoSourceMiddleware", () => {
  const next = jest.fn();

  let ctx: any;
  let source: IMongoSource;

  beforeEach(() => {
    ctx = { logger: "logger" };
    source = { clone: () => ({ clonedSource: true }) } as any;
  });

  test("should set source on context", async () => {
    await expect(
      createSocketMongoSourceMiddleware(source)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.mongo).toEqual({ clonedSource: true });
  });
});
