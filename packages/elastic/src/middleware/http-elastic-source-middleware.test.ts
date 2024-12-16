import { IElasticSource } from "../interfaces";
import { createHttpElasticSourceMiddleware } from "./http-elastic-source-middleware";

describe("createHttpElasticSourceMiddleware", () => {
  const next = jest.fn();

  let ctx: any;
  let source: IElasticSource;

  beforeEach(() => {
    ctx = { logger: "logger" };
    source = { clone: () => ({ clonedSource: true }) } as any;
  });

  test("should set source on context", async () => {
    await expect(
      createHttpElasticSourceMiddleware(source)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.elastic).toEqual({ clonedSource: true });
  });
});
