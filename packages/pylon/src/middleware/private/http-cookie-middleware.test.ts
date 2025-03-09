import { Next } from "@lindorm/middleware";
import MockDate from "mockdate";
import { PylonCookieConfig, SetCookieOptions } from "../../types";
import {
  decodeCookieValue as _decodeCookieValue,
  encodeCookieValue as _encodeCookieValue,
} from "../../utils/private";
import { createHttpCookieMiddleware } from "./http-cookie-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

jest.mock("../../utils/private");

const decodeCookieValue = _decodeCookieValue as jest.Mock;
const encodeCookieValue = _encodeCookieValue as jest.Mock;

describe("httpCookieMiddleware", () => {
  let ctx: any;
  let next: Next;
  let config: PylonCookieConfig;
  let options: SetCookieOptions;

  beforeEach(() => {
    ctx = {
      cookies: {
        set: jest.fn(),
        get: jest.fn(),
      },
    };

    config = {
      domain: "test-domain",
      encrypted: true,
      httpOnly: true,
      overwrite: true,
      priority: "high",
      sameSite: "strict",
      signed: true,
    };

    options = {
      encrypted: true,
      expiry: "20 minutes",
      httpOnly: false,
      overwrite: false,
      path: "/hello",
      priority: "medium",
      sameSite: "lax",
      signed: false,
    };

    next = () => Promise.resolve();

    decodeCookieValue.mockResolvedValue("decode");
    encodeCookieValue.mockResolvedValue("encode");
  });

  test("should add functions to context", async () => {
    await expect(createHttpCookieMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.setCookie).toBeDefined();
    expect(ctx.getCookie).toBeDefined();
    expect(ctx.delCookie).toBeDefined();
  });

  test("should set cookie with default set options", async () => {
    await createHttpCookieMiddleware()(ctx, next);

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
    await createHttpCookieMiddleware(config)(ctx, next);

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
    await createHttpCookieMiddleware(config)(ctx, next);

    await ctx.setCookie("name", "value", options);

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
    await createHttpCookieMiddleware(config)(ctx, next);

    ctx.cookies.get.mockReturnValue("value");

    await expect(ctx.getCookie("name")).resolves.toEqual("decode");

    expect(ctx.cookies.get).toHaveBeenCalledWith("name", {
      signed: true,
    });
    expect(decodeCookieValue).toHaveBeenCalledWith(ctx, "value");
  });

  test("should delete cookie", async () => {
    await createHttpCookieMiddleware(config)(ctx, next);

    ctx.delCookie("name");

    expect(ctx.cookies.set).toHaveBeenCalledWith("name", null);
  });
});
