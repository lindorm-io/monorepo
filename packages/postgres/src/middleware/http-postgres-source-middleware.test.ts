import { createMockLogger } from "@lindorm/logger";
import { IPostgresSource } from "../interfaces";
import { createHttpPostgresSourceMiddleware } from "./http-postgres-source-middleware";

describe("createHttpPostgresSourceMiddleware", () => {
  const next = jest.fn();

  let ctx: any;
  let source: IPostgresSource;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
    };
    source = { clone: () => ({ clonedSource: true }) } as any;
  });

  test("should set source on context", async () => {
    await expect(
      createHttpPostgresSourceMiddleware(source)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.sources.postgres).toEqual({ clonedSource: true });
  });
});
