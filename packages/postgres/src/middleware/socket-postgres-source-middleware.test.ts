import { createMockLogger } from "@lindorm/logger";
import { IPostgresSource } from "../interfaces";
import { createSocketPostgresSourceMiddleware } from "./socket-postgres-source-middleware";

describe("createSocketPostgresSourceMiddleware", () => {
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
      createSocketPostgresSourceMiddleware(source)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.sources.postgres).toEqual({ clonedSource: true });
  });
});
