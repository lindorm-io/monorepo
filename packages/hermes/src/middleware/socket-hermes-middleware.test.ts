import { IHermes } from "../interfaces";
import { createSocketHermesMiddleware } from "./socket-hermes-middleware";

describe("createSocketHermesMiddleware", () => {
  const next = jest.fn();

  let ctx: any;
  let hermes: IHermes;

  beforeEach(() => {
    ctx = { logger: "logger" };
    hermes = { clone: () => ({ clonedSource: true }) } as any;
  });

  test("should set source on context", async () => {
    await expect(createSocketHermesMiddleware(hermes)(ctx, next)).resolves.not.toThrow();

    expect(ctx.hermes).toEqual({ clonedSource: true });
  });
});
