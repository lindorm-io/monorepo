import { IRabbitSource } from "../interfaces";
import { createSocketRabbitSourceMiddleware } from "./socket-rabbit-source-middleware";

describe("createSocketRabbitSourceMiddleware", () => {
  const next = jest.fn();

  let ctx: any;
  let source: IRabbitSource;

  beforeEach(() => {
    ctx = { logger: "logger" };
    source = { clone: () => ({ clonedSource: true }) } as any;
  });

  test("should set source on context", async () => {
    await expect(
      createSocketRabbitSourceMiddleware(source)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.rabbit).toEqual({ clonedSource: true });
  });
});
