import { Next } from "@lindorm/middleware";
import MockDate from "mockdate";
import { PylonSessionConfig } from "../../types";
import {
  decodeCookieValue as _decodeCookieValue,
  encodeCookieValue as _encodeCookieValue,
} from "../../utils/private";
import { createHttpFunctionsMiddleware } from "./http-functions-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

jest.mock("../../utils/private");

const decodeCookieValue = _decodeCookieValue as jest.Mock;
const encodeCookieValue = _encodeCookieValue as jest.Mock;

describe("httpFunctionsMiddleware", () => {
  let ctx: any;
  let next: Next;
  let sessionConfig: PylonSessionConfig;

  beforeEach(() => {
    ctx = {
      cookies: {
        set: jest.fn(),
        get: jest.fn(),
        del: jest.fn(),
      },
    };

    sessionConfig = {
      encrypted: false,
      expiry: "90 minutes",
      httpOnly: true,
      sameSite: "strict",
      signed: true,
      name: "test_pylon_session",
      store: {
        set: jest.fn().mockResolvedValue("cad4002a-bd04-52f1-9733-58866f421686"),
        get: jest.fn().mockResolvedValue({
          id: "cad4002a-bd04-52f1-9733-58866f421686",
          accessToken: "access_token",
          idToken: "id_token",
          refreshToken: "refresh_token",
        }),
        del: jest.fn(),
      },
    };

    next = () => Promise.resolve();

    decodeCookieValue.mockResolvedValue("decode");
    encodeCookieValue.mockResolvedValue("encode");
  });

  test("should set session in store", async () => {
    await createHttpFunctionsMiddleware(sessionConfig)(ctx, next);

    await ctx.sessions.set({
      id: "cad4002a-bd04-52f1-9733-58866f421686",
      accessToken: "access_token",
      idToken: "id_token",
      refreshToken: "refresh_token",
    });

    expect(sessionConfig.store!.set).toHaveBeenCalled();
    expect(ctx.cookies.set).toHaveBeenCalledWith(
      "test_pylon_session",
      "cad4002a-bd04-52f1-9733-58866f421686",
      {
        encrypted: false,
        expiry: "90 minutes",
        httpOnly: true,
        name: "test_pylon_session",
        sameSite: "strict",
        signed: true,
        store: {
          del: expect.any(Function),
          get: expect.any(Function),
          set: expect.any(Function),
        },
      },
    );
  });

  test("should set session in cookie", async () => {
    sessionConfig.store = undefined;

    await createHttpFunctionsMiddleware(sessionConfig)(ctx, next);

    await ctx.sessions.set({
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
        name: "test_pylon_session",
        sameSite: "strict",
        signed: true,
        store: undefined,
      },
    );
  });

  test("should get session from store", async () => {
    await createHttpFunctionsMiddleware(sessionConfig)(ctx, next);

    await expect(ctx.sessions.get()).resolves.toEqual({
      id: "cad4002a-bd04-52f1-9733-58866f421686",
      accessToken: "access_token",
      idToken: "id_token",
      refreshToken: "refresh_token",
    });
  });

  test("should get session from cookie", async () => {
    sessionConfig.store = undefined;

    ctx.cookies.get.mockReturnValue("value");

    await createHttpFunctionsMiddleware(sessionConfig)(ctx, next);

    await expect(ctx.sessions.get()).resolves.toEqual("value");
  });

  test("should delete session from store", async () => {
    await createHttpFunctionsMiddleware(sessionConfig)(ctx, next);

    await expect(ctx.sessions.del()).resolves.toBeUndefined();

    expect(sessionConfig.store!.del).toHaveBeenCalled();
    expect(ctx.cookies.del).toHaveBeenCalledWith("test_pylon_session");
  });

  test("should delete session", async () => {
    sessionConfig.store = undefined;

    await createHttpFunctionsMiddleware(sessionConfig)(ctx, next);

    await expect(ctx.sessions.del()).resolves.toBeUndefined();

    expect(ctx.cookies.del).toHaveBeenCalledWith("test_pylon_session");
  });
});
