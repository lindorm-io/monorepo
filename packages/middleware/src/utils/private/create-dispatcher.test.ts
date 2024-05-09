import { Middleware, Next } from "../../types";
import { _createDispatcher } from "./create-dispatcher";

describe("createDispatcher", () => {
  let ctx: any;
  let next: Next;

  const mw1: Middleware<any> = async (c, n) => {
    c.mw1before = true;
    c.before = 1;

    await n();

    c.mw1after = true;
    c.after = 1;
  };

  const mw2: Middleware<any> = async (c, n) => {
    c.mw2before = true;
    c.before = 2;

    await n();

    c.mw2after = true;
    c.after = 2;
  };

  const mw3: Middleware<any> = async () => {
    throw new Error("message");
  };

  beforeEach(() => {
    ctx = {};
    next = () => Promise.resolve();
  });

  afterEach(jest.resetAllMocks);

  test("should compose", async () => {
    expect(_createDispatcher([mw1, mw2])).toBeInstanceOf(Function);
  });

  test("should resolve", async () => {
    const composed = _createDispatcher([mw1, mw2]);

    await expect(composed(ctx, next)).resolves.not.toThrow();
  });

  test("should throw", async () => {
    const composed = _createDispatcher([mw1, mw2, mw3]);

    await expect(composed(ctx, next)).rejects.toThrow(new Error("message"));
  });

  test("should run all middleware", async () => {
    const composed = _createDispatcher([mw1, mw2]);
    await composed(ctx, next);

    expect(ctx.mw1before).toEqual(true);
    expect(ctx.mw1after).toEqual(true);

    expect(ctx.mw2before).toEqual(true);
    expect(ctx.mw2after).toEqual(true);

    expect(ctx.before).toEqual(2);
    expect(ctx.after).toEqual(1);
  });
});
