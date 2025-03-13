import { Next } from "@lindorm/middleware";
import MockDate from "mockdate";
import { PylonCookieConfig, PylonSessionConfig, SetCookieOptions } from "../../types";
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

describe("httpCookieMiddleware", () => {
  let ctx: any;
  let next: Next;
  let cookieConfig: PylonCookieConfig;
  let cookieOptions: SetCookieOptions;
  let sessionConfig: PylonSessionConfig;

  beforeEach(() => {
    ctx = {
      cookies: {
        set: jest.fn(),
        get: jest.fn(),
      },
    };

    cookieConfig = {
      domain: "test-domain",
      encrypted: true,
      httpOnly: true,
      overwrite: true,
      priority: "high",
      sameSite: "strict",
      signed: true,
    };

    cookieOptions = {
      encrypted: true,
      expiry: "20 minutes",
      httpOnly: false,
      overwrite: false,
      path: "/hello",
      priority: "medium",
      sameSite: "lax",
      signed: false,
    };

    sessionConfig = {
      encrypted: false,
      expiry: "90 minutes",
      httpOnly: true,
      sameSite: "strict",
      signed: true,
      name: "test_pylon_session",
      store: {
        setSession: jest.fn().mockResolvedValue("cad4002a-bd04-52f1-9733-58866f421686"),
        getSession: jest.fn().mockResolvedValue({
          id: "cad4002a-bd04-52f1-9733-58866f421686",
          accessToken: "access_token",
          idToken: "id_token",
          refreshToken: "refresh_token",
        }),
        delSession: jest.fn(),
      },
    };

    next = () => Promise.resolve();

    decodeCookieValue.mockResolvedValue("decode");
    encodeCookieValue.mockResolvedValue("encode");
  });

  test("should add functions to context", async () => {
    await expect(
      createHttpFunctionsMiddleware(cookieConfig)(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.setCookie).toBeDefined();
    expect(ctx.getCookie).toBeDefined();
    expect(ctx.delCookie).toBeDefined();
  });

  test("should set cookie with default set options", async () => {
    await createHttpFunctionsMiddleware()(ctx, next);

    await ctx.setCookie("name", "value");

    expect(ctx.cookies.set).toHaveBeenCalledWith("name", "encode", {
      domain: undefined,
      expires: undefined,
      httpOnly: false,
      overwrite: false,
      path: undefined,
      priority: undefined,
      sameSite: false,
      signed: false,
    });
  });

  test("should set cookie with config", async () => {
    await createHttpFunctionsMiddleware(cookieConfig)(ctx, next);

    await ctx.setCookie("name", "value");

    expect(ctx.cookies.set).toHaveBeenCalledWith("name", "encode", {
      domain: "test-domain",
      expires: undefined,
      httpOnly: true,
      overwrite: true,
      path: undefined,
      priority: "high",
      sameSite: "strict",
      signed: true,
    });
  });

  test("should set cookie with options", async () => {
    await createHttpFunctionsMiddleware(cookieConfig)(ctx, next);

    await ctx.setCookie("name", "value", cookieOptions);

    expect(ctx.cookies.set).toHaveBeenCalledWith("name", "encode", {
      domain: "test-domain",
      expires: new Date("2024-01-01T08:20:00.000Z"),
      httpOnly: false,
      overwrite: false,
      path: "/hello",
      priority: "medium",
      sameSite: "lax",
      signed: false,
    });
  });

  test("should get cookie", async () => {
    await createHttpFunctionsMiddleware(cookieConfig)(ctx, next);

    ctx.cookies.get.mockReturnValue("value");

    await expect(ctx.getCookie("name")).resolves.toEqual("decode");

    expect(ctx.cookies.get).toHaveBeenCalledWith("name", {
      signed: true,
    });
    expect(decodeCookieValue).toHaveBeenCalledWith(ctx, "value");
  });

  test("should delete cookie", async () => {
    await createHttpFunctionsMiddleware(cookieConfig)(ctx, next);

    ctx.delCookie("name");

    expect(ctx.cookies.set).toHaveBeenCalledWith("name", null);
  });

  test("should set session in store", async () => {
    await createHttpFunctionsMiddleware(cookieConfig, sessionConfig)(ctx, next);

    await ctx.setSession({
      id: "cad4002a-bd04-52f1-9733-58866f421686",
      accessToken: "access_token",
      idToken: "id_token",
      refreshToken: "refresh_token",
    });

    expect(sessionConfig.store!.setSession).toHaveBeenCalled();
    expect(ctx.cookies.set).toHaveBeenCalledWith("test_pylon_session", "encode", {
      domain: "test-domain",
      expires: new Date("2024-01-01T09:30:00.000Z"),
      httpOnly: true,
      overwrite: true,
      path: undefined,
      priority: "high",
      sameSite: "strict",
      signed: true,
    });
  });

  test("should set session in cookie", async () => {
    sessionConfig.store = undefined;

    await createHttpFunctionsMiddleware(cookieConfig, sessionConfig)(ctx, next);

    await ctx.setSession({
      id: "cad4002a-bd04-52f1-9733-58866f421686",
      accessToken: "access_token",
      idToken: "id_token",
      refreshToken: "refresh_token",
    });

    expect(ctx.cookies.set).toHaveBeenCalledWith("test_pylon_session", "encode", {
      domain: "test-domain",
      expires: new Date("2024-01-01T09:30:00.000Z"),
      httpOnly: true,
      overwrite: true,
      path: undefined,
      priority: "high",
      sameSite: "strict",
      signed: true,
    });
  });

  test("should get session from store", async () => {
    await createHttpFunctionsMiddleware(cookieConfig, sessionConfig)(ctx, next);

    await expect(ctx.getSession()).resolves.toEqual({
      id: "cad4002a-bd04-52f1-9733-58866f421686",
      accessToken: "access_token",
      idToken: "id_token",
      refreshToken: "refresh_token",
    });
  });

  test("should get session from cookie", async () => {
    sessionConfig.store = undefined;

    ctx.cookies.get.mockReturnValue("value");

    await createHttpFunctionsMiddleware(cookieConfig, sessionConfig)(ctx, next);

    await expect(ctx.getSession()).resolves.toEqual("decode");
  });

  test("should delete session from store", async () => {
    await createHttpFunctionsMiddleware(cookieConfig, sessionConfig)(ctx, next);

    await expect(ctx.delSession()).resolves.toBeUndefined();

    expect(sessionConfig.store!.delSession).toHaveBeenCalled();
    expect(ctx.cookies.set).toHaveBeenCalledWith("test_pylon_session", null);
  });

  test("should delete session", async () => {
    sessionConfig.store = undefined;

    await createHttpFunctionsMiddleware(cookieConfig, sessionConfig)(ctx, next);

    await expect(ctx.delSession()).resolves.toBeUndefined();

    expect(ctx.cookies.set).toHaveBeenCalledWith("test_pylon_session", null);
  });
});
