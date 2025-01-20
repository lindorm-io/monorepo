import { createMockLogger } from "@lindorm/logger";
import { IMnemosSource } from "../interfaces";
import { createSocketMnemosSourceMiddleware } from "./socket-mnemos-source-middleware";

describe("createSocketMnemosSourceMiddleware", () => {
  const next = jest.fn();

  let ctx: any;
  let source: IMnemosSource;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
    };
    source = { clone: () => ({ clonedSource: true }) } as any;
  });

  test("should set source on context", async () => {
    await expect(
      createSocketMnemosSourceMiddleware(source)(ctx, next),
    ).resolves.not.toThrow();

    expect(ctx.sources.mnemos).toEqual({ clonedSource: true });
  });
});
