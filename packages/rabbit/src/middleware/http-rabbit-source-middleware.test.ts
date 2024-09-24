import { IRabbitSource } from "../interfaces";
import { createHttpRabbitSourceMiddleware } from "./http-rabbit-source-middleware";

describe("createHttpRabbitSourceMiddleware", () => {
  const next = jest.fn();

  let ctx: any;
  let source: IRabbitSource;

  beforeEach(() => {
    ctx = { logger: "logger" };
    source = { clone: () => ({ clonedSource: true }) } as any;
  });

  test("should set source on context", async () => {
    await expect(
      createHttpRabbitSourceMiddleware(source)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.rabbit).toEqual({ clonedSource: true });
  });
});
