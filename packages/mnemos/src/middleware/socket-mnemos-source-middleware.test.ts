import { IMnemosSource } from "../interfaces";
import { createSocketMnemosSourceMiddleware } from "./socket-mnemos-source-middleware";

describe("createSocketMnemosSourceMiddleware", () => {
  const next = jest.fn();

  let ctx: any;
  let source: IMnemosSource;

  beforeEach(() => {
    ctx = { logger: "logger" };
    source = { clone: () => ({ clonedSource: true }) } as any;
  });

  test("should set source on context", async () => {
    await expect(
      createSocketMnemosSourceMiddleware(source)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.mnemos).toEqual({ clonedSource: true });
  });
});
