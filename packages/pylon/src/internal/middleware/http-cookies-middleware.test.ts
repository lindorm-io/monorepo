import { AesKit } from "@lindorm/aes";
import { createMockAegis } from "@lindorm/aegis";
import { createMockAmphora } from "@lindorm/amphora";
import { B64 } from "@lindorm/b64";
import { PylonCookieConfig } from "../../types";
import { parseCookieHeader as _parseCookieHeader } from "../utils/cookies/parse-cookie-header";
import { signCookie as _signCookie } from "../utils/cookies/sign-cookie";
import { verifyCookie as _verifyCookie } from "../utils/cookies/verify-cookie";
import { createHttpCookiesMiddleware } from "./http-cookies-middleware";

jest.mock("../utils/cookies/parse-cookie-header");
jest.mock("../utils/cookies/sign-cookie");
jest.mock("../utils/cookies/verify-cookie");

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
      amphora: createMockAmphora(),
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
      { name: "cookie_name", signature: "cookie_signature", value: "Y29va2llX3ZhbHVl" },
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
      "new_cookie=bmV3X3ZhbHVl; domain=http://lindorm.io; path=/; samesite=strict; secure; httponly",
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

    expect(ctx.aegis.aes.encrypt).toHaveBeenCalledWith("new_value", "tokenised");

    const setCookieHeader = ctx.set.mock.calls[0][1][0] as string;
    const cookieValue = setCookieHeader.split("=")[1].split(";")[0];

    expect(AesKit.isAesTokenised(cookieValue)).toBe(true);
  });

  test("should set cookie with signature", async () => {
    next.mockImplementation(async () => {
      ctx.cookies.set("new_cookie", "new_value", { signed: true });
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.set).toHaveBeenCalledWith("set-cookie", [
      "new_cookie=bmV3X3ZhbHVl; domain=http://lindorm.io; path=/; samesite=strict; secure; httponly",
      "new_cookie.sig=signature; domain=http://lindorm.io; path=/; samesite=strict; secure; httponly",
    ]);
  });

  test("should set cookie with json data", async () => {
    next.mockImplementation(async () => {
      ctx.cookies.set("new_cookie", { key: "value" }, { encoding: "hex" });
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.set).toHaveBeenCalledWith("set-cookie", [
      "new_cookie=7b226b6579223a2276616c7565227d; domain=http://lindorm.io; path=/; samesite=strict; secure; httponly",
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
    const tokenised = `aes:${Buffer.from(JSON.stringify("secret_value")).toString("base64url")}`;

    parseCookieHeader.mockReturnValue([
      { name: "cookie_name", signature: "cookie_signature", value: tokenised },
    ]);

    next.mockImplementation(async () => {
      await expect(ctx.cookies.get("cookie_name")).resolves.toEqual("secret_value");
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.aegis.aes.decrypt).toHaveBeenCalledWith(tokenised);
  });

  test("should get signed cookie", async () => {
    parseCookieHeader.mockReturnValue([
      { name: "cookie_name", signature: "cookie_signature", value: "Y29va2llX3ZhbHVl" },
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
      {
        name: "cookie_name",
        signature: "cookie_signature",
        value: B64.encode('{"key":"value"}', "b64u"),
      },
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
