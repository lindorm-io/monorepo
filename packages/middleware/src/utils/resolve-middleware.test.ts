import { Middleware } from "../types";
import { resolveMiddleware } from "./resolve-middleware";

describe("resolveMiddleware", () => {
  let ctx: any;

  const mw: Middleware<any> = async (c, n) => {
    c.mwbefore = true;
    c.before = 1;

    await n();

    c.mwafter = true;
    c.after = 1;
  };

  const mwE: Middleware<any> = async () => {
    throw new Error("error");
  };

  beforeEach(() => {
    ctx = { context: "context" };
  });

  afterEach(jest.resetAllMocks);

  test("should resolve", async () => {
    await expect(resolveMiddleware(ctx, [mw])).resolves.toEqual({
      after: 1,
      before: 1,
      context: "context",
      mwafter: true,
      mwbefore: true,
    });

    expect(ctx).toEqual({ context: "context" });
  });

  test("should resolve without cloning context", async () => {
    await expect(resolveMiddleware(ctx, [mw], { useClone: false })).resolves.toEqual({
      after: 1,
      before: 1,
      context: "context",
      mwafter: true,
      mwbefore: true,
    });

    expect(ctx).toEqual({
      after: 1,
      before: 1,
      context: "context",
      mwafter: true,
      mwbefore: true,
    });
  });

  test("should throw", async () => {
    await expect(resolveMiddleware(ctx, [mwE])).rejects.toThrow();

    expect(ctx).toEqual({ context: "context" });
  });
});
