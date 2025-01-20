import { createMockLogger } from "@lindorm/logger";
import { IElasticSource } from "../interfaces";
import { createSocketElasticSourceMiddleware } from "./socket-elastic-source-middleware";

describe("createSocketElasticSourceMiddleware", () => {
  const next = jest.fn();

  let ctx: any;
  let source: IElasticSource;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
    };
    source = { clone: () => ({ clonedSource: true }) } as any;
  });

  test("should set source on context", async () => {
    await expect(
      createSocketElasticSourceMiddleware(source)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.sources.elastic).toEqual({ clonedSource: true });
  });
});
