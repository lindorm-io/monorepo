import { createMockAegis } from "@lindorm/aegis";
import { PylonCookieConfig } from "../../types";
import {
  parseCookieHeader as _parseCookieHeader,
  signCookie as _signCookie,
  verifyCookie as _verifyCookie,
} from "../../utils/private";
import { createHttpCookiesMiddleware } from "./http-cookies-middleware";

jest.mock("../../utils/private");

const parseCookieHeader = _parseCookieHeader as jest.Mock;
const signCookie = _signCookie as jest.Mock;
const verifyCookie = _verifyCookie as jest.Mock;

describe("httpCookiesMiddleware", () => {
  let config: PylonCookieConfig;
  let ctx: any;
  let next: jest.Mock;

  beforeEach(() => {
    ctx = {
      aegis: createMockAegis(),
      get: jest.fn().mockReturnValue(""),
      set: jest.fn(),
    };

    next = jest.fn();

    config = {
      domain: "http://lindorm.io",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    };

    parseCookieHeader.mockReturnValue([
      { name: "cookie_name", signature: "cookie_signature", value: "cookie_value" },
    ]);
    signCookie.mockResolvedValue("signature");
    verifyCookie.mockResolvedValue(undefined);
  });

  test("should set cookie with string", async () => {
    next.mockImplementation(async () => {
      ctx.cookies.set("new_cookie", "new_value");
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.set).toHaveBeenCalledWith("set-cookie", [
      "new_cookie=new_value; domain=http://lindorm.io; path=/; samesite=strict; secure; httponly",
    ]);
  });

  test("should set cookie with encoding", async () => {
    next.mockImplementation(async () => {
      ctx.cookies.set("new_cookie", "new_value", { encoding: "base64" });
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.set).toHaveBeenCalledWith("set-cookie", [
      "new_cookie=bmV3X3ZhbHVl; domain=http://lindorm.io; path=/; samesite=strict; secure; httponly",
    ]);
  });

  test("should set cookie with encryption", async () => {
    next.mockImplementation(async () => {
      ctx.cookies.set("new_cookie", "new_value", { encrypted: true });
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.set).toHaveBeenCalledWith("set-cookie", [
      "new_cookie=mocked_token; domain=http://lindorm.io; path=/; samesite=strict; secure; httponly",
    ]);
  });

  test("should set cookie with signature", async () => {
    next.mockImplementation(async () => {
      ctx.cookies.set("new_cookie", "new_value", { signed: true });
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.set).toHaveBeenCalledWith("set-cookie", [
      "new_cookie=new_value; domain=http://lindorm.io; path=/; samesite=strict; secure; httponly",
      "new_cookie.sig=signature; domain=http://lindorm.io; path=/; samesite=strict; secure; httponly",
    ]);
  });

  test("should set cookie with json data", async () => {
    next.mockImplementation(async () => {
      ctx.cookies.set("new_cookie", { key: "value" });
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.set).toHaveBeenCalledWith("set-cookie", [
      'new_cookie={"key":"value"}; domain=http://lindorm.io; path=/; samesite=strict; secure; httponly',
    ]);
  });

  test("should get cookie", async () => {
    next.mockImplementation(async () => {
      await expect(ctx.cookies.get("cookie_name")).resolves.toEqual("cookie_value");
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.get).toHaveBeenCalledWith("cookie");
  });

  test("should get encoded cookie", async () => {
    parseCookieHeader.mockReturnValue([
      { name: "cookie_name", signature: "cookie_signature", value: "bmV3X3ZhbHVl" },
    ]);

    next.mockImplementation(async () => {
      await expect(
        ctx.cookies.get("cookie_name", { encoding: "base64" }),
      ).resolves.toEqual("new_value");
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();
  });

  test("should get encrypted cookie", async () => {
    parseCookieHeader.mockReturnValue([
      { name: "cookie_name", signature: "cookie_signature", value: "cookie_value" },
    ]);

    next.mockImplementation(async () => {
      await expect(ctx.cookies.get("cookie_name", { encrypted: true })).resolves.toEqual(
        "mocked_payload",
      );
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();
  });

  test("should get signed cookie", async () => {
    parseCookieHeader.mockReturnValue([
      { name: "cookie_name", signature: "cookie_signature", value: "cookie_value" },
    ]);

    next.mockImplementation(async () => {
      await expect(ctx.cookies.get("cookie_name", { signed: true })).resolves.toEqual(
        "cookie_value",
      );
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    expect(verifyCookie).toHaveBeenCalled();
  });

  test("should get cookie with json data", async () => {
    parseCookieHeader.mockReturnValue([
      { name: "cookie_name", signature: "cookie_signature", value: '{"key":"value"}' },
    ]);

    next.mockImplementation(async () => {
      await expect(ctx.cookies.get("cookie_name")).resolves.toEqual({
        key: "value",
      });
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();
  });

  test("should delete cookie", async () => {
    next.mockImplementation(async () => {
      ctx.cookies.del("cookie_name");
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.set).toHaveBeenCalledWith("set-cookie", [
      "cookie_name=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ]);
  });
});
