import { IPostgresSource } from "../interfaces";
import { createHttpPostgresSourceMiddleware } from "./http-postgres-source-middleware";

describe("createHttpPostgresSourceMiddleware", () => {
  const next = jest.fn();

  let ctx: any;
  let source: IPostgresSource;

  beforeEach(() => {
    ctx = { logger: "logger" };
    source = { clone: () => ({ clonedSource: true }) } as any;
  });

  test("should set source on context", async () => {
    await expect(
      createHttpPostgresSourceMiddleware(source)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.postgres).toEqual({ clonedSource: true });
  });
});
