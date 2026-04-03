import { createMockLogger } from "@lindorm/logger";
import { Next } from "@lindorm/middleware";
import MockDate from "mockdate";
import { IPylonSessionStore } from "../../interfaces/PylonSessionStore";
import { PylonSessionOptions } from "../../types";
import { createHttpSessionMiddleware } from "./http-session-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

jest.mock("@lindorm/aegis", () => ({
  Aegis: class Aegis {
    public static parse() {
      return "parsed";
    }
  },
}));

describe("httpSessionMiddleware", () => {
  let ctx: any;
  let next: Next;
  let options: PylonSessionOptions;
  let store: IPylonSessionStore;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      cookies: {
        set: jest.fn(),
        get: jest.fn(),
        del: jest.fn(),
      },
      state: {
        metadata: {},
        session: null,
        tokens: {},
      },
    };

    store = {
      set: jest.fn().mockResolvedValue("cad4002a-bd04-52f1-9733-58866f421686"),
      get: jest.fn().mockResolvedValue({
        id: "cad4002a-bd04-52f1-9733-58866f421686",
        accessToken: "access_token",
        idToken: "id_token",
        refreshToken: "refresh_token",
      }),
      del: jest.fn(),
      logout: jest.fn(),
    };

    options = {
      use: "custom",
      custom: store,

      encrypted: false,
      expiry: "90 minutes",
      httpOnly: true,
      sameSite: "strict",
      signed: true,
      name: "test_pylon_session",
    };

    next = () => Promise.resolve();
  });

  test("should set session in store", async () => {
    await createHttpSessionMiddleware(options)(ctx, next);

    await ctx.session.set({
      id: "cad4002a-bd04-52f1-9733-58866f421686",
      accessToken: "access_token",
      idToken: "id_token",
      refreshToken: "refresh_token",
    });

    expect(store.set).toHaveBeenCalled();
    expect(ctx.cookies.set).toHaveBeenCalledWith(
      "test_pylon_session",
      "cad4002a-bd04-52f1-9733-58866f421686",
      {
        encrypted: false,
        expiry: "90 minutes",
        httpOnly: true,
        sameSite: "strict",
        signed: true,
      },
    );
  });

  test("should set session in cookie", async () => {
    options.use = "cookie";

    await createHttpSessionMiddleware(options)(ctx, next);

    await ctx.session.set({
      id: "cad4002a-bd04-52f1-9733-58866f421686",
      accessToken: "access_token",
      idToken: "id_token",
      refreshToken: "refresh_token",
    });

    expect(ctx.cookies.set).toHaveBeenCalledWith(
      "test_pylon_session",
      {
        accessToken: "access_token",
        id: "cad4002a-bd04-52f1-9733-58866f421686",
        idToken: "id_token",
        refreshToken: "refresh_token",
      },
      {
        encrypted: false,
        expiry: "90 minutes",
        httpOnly: true,
        sameSite: "strict",
        signed: true,
      },
    );
  });

  test("should get session from store", async () => {
    await createHttpSessionMiddleware(options)(ctx, next);

    expect(ctx.state.session).toEqual({
      id: "cad4002a-bd04-52f1-9733-58866f421686",
      accessToken: "access_token",
      idToken: "id_token",
      refreshToken: "refresh_token",
    });

    await expect(ctx.session.get()).resolves.toEqual({
      id: "cad4002a-bd04-52f1-9733-58866f421686",
      accessToken: "access_token",
      idToken: "id_token",
      refreshToken: "refresh_token",
    });
  });

  test("should get session from cookie", async () => {
    options.use = "cookie";

    ctx.cookies.get.mockReturnValue("value");

    await createHttpSessionMiddleware(options)(ctx, next);

    expect(ctx.state.session).toEqual("value");

    await expect(ctx.session.get()).resolves.toEqual("value");
  });

  test("should delete session from store", async () => {
    await createHttpSessionMiddleware(options)(ctx, next);

    await expect(ctx.session.del()).resolves.toBeUndefined();

    expect(store.del).toHaveBeenCalled();
    expect(ctx.cookies.del).toHaveBeenCalledWith("test_pylon_session");
  });

  test("should delete session", async () => {
    options.use = "cookie";

    await createHttpSessionMiddleware(options)(ctx, next);

    await expect(ctx.session.del()).resolves.toBeUndefined();

    expect(ctx.cookies.del).toHaveBeenCalledWith("test_pylon_session");
  });
});
