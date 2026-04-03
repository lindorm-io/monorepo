import { Aegis } from "@lindorm/aegis";
import { Conduit } from "@lindorm/conduit";
import { createCommonContextInitialisationMiddleware } from "./common-context-initialisation-middleware";

jest.mock("@lindorm/aegis");
jest.mock("@lindorm/conduit");

describe("createCommonContextInitialisationMiddleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should return a middleware function", () => {
    const amphora: any = {};
    const middleware = createCommonContextInitialisationMiddleware(amphora);

    expect(typeof middleware).toBe("function");
  });

  test("should set amphora on context", async () => {
    const amphora: any = { keys: [] };
    const middleware = createCommonContextInitialisationMiddleware(amphora);

    const ctx: any = { logger: {} };
    const next = jest.fn();

    await middleware(ctx, next);

    expect(ctx.amphora).toBe(amphora);
  });

  test("should create Aegis with amphora and logger", async () => {
    const amphora: any = { keys: [] };
    const middleware = createCommonContextInitialisationMiddleware(amphora);

    const logger: any = { child: jest.fn() };
    const ctx: any = { logger };
    const next = jest.fn();

    await middleware(ctx, next);

    expect(Aegis).toHaveBeenCalledWith({
      amphora,
      logger,
    });
    expect(ctx.aegis).toBeInstanceOf(Aegis);
  });

  test("should initialize conduits with a Conduit instance", async () => {
    const amphora: any = {};
    const middleware = createCommonContextInitialisationMiddleware(amphora);

    const ctx: any = { logger: {} };
    const next = jest.fn();

    await middleware(ctx, next);

    expect(Conduit).toHaveBeenCalled();
    expect(ctx.conduits).toEqual(
      expect.objectContaining({
        conduit: expect.any(Conduit),
      }),
    );
  });

  test("should initialize entities as empty object", async () => {
    const amphora: any = {};
    const middleware = createCommonContextInitialisationMiddleware(amphora);

    const ctx: any = { logger: {} };
    const next = jest.fn();

    await middleware(ctx, next);

    expect(ctx.entities).toEqual({});
  });

  test("should call next", async () => {
    const amphora: any = {};
    const middleware = createCommonContextInitialisationMiddleware(amphora);

    const ctx: any = { logger: {} };
    const next = jest.fn();

    await middleware(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
