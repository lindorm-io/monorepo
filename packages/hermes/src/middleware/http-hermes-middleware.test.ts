import { IHermes } from "../interfaces";
import { createHttpHermesMiddleware } from "./http-hermes-middleware";

describe("createHttpHermesMiddleware", () => {
  const next = jest.fn();

  let ctx: any;
  let hermes: IHermes;

  beforeEach(() => {
    ctx = { logger: "logger" };
    hermes = { clone: () => ({ clonedSource: true }) } as any;
  });

  test("should set source on context", async () => {
    await expect(createHttpHermesMiddleware(hermes)(ctx, next)).resolves.not.toThrow();

    expect(ctx.hermes).toEqual({ clonedSource: true });
  });
});
