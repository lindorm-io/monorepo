import { createMockLogger } from "@lindorm/logger";
import { IRabbitSource } from "../interfaces";
import { createHttpRabbitSourceMiddleware } from "./http-rabbit-source-middleware";

describe("createHttpRabbitSourceMiddleware", () => {
  const next = jest.fn();

  let ctx: any;
  let source: IRabbitSource;

  beforeEach(() => {
    ctx = { logger: createMockLogger() };
    source = { clone: () => ({ clonedSource: true }) } as any;
  });

  test("should set source on context", async () => {
    await expect(
      createHttpRabbitSourceMiddleware(source)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.sources.rabbit).toEqual({ clonedSource: true });
  });
});
