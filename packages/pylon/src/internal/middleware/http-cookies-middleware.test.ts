import { Aegis } from "@lindorm/aegis";
import { createMockAegis } from "@lindorm/aegis/mocks/vitest";
import { AesKit } from "@lindorm/aes";
import { Amphora } from "@lindorm/amphora";
import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";
import { B64 } from "@lindorm/b64";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { PylonCookieSettings } from "../../types/index.js";
import { parseCookieHeader as _parseCookieHeader } from "../utils/cookies/parse-cookie-header.js";
import { signCookie as _signCookie } from "../utils/cookies/sign-cookie.js";
import { verifyCookie as _verifyCookie } from "../utils/cookies/verify-cookie.js";
import { createHttpCookiesMiddleware } from "./http-cookies-middleware.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

vi.mock("../utils/cookies/parse-cookie-header.js");
vi.mock("../utils/cookies/sign-cookie.js");
vi.mock("../utils/cookies/verify-cookie.js");

const parseCookieHeader = _parseCookieHeader as Mock;
const signCookie = _signCookie as Mock;
const verifyCookie = _verifyCookie as Mock;

// What a deployment's flat `cookies` selectors say. Pylon guesses none of it.
const cookieKeys: PylonCookieSettings = {
  signature: { predicate: { purpose: "cookie", publish: false } },
  encryption: { predicate: { purpose: "cookie", publish: false } },
};

describe("httpCookiesMiddleware", async () => {
  let config: PylonCookieSettings;
  let ctx: any;
  let next: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    ctx = {
      aegis: createMockAegis(),
      amphora: createMockAmphora(),
      get: vi.fn().mockReturnValue(""),
      set: vi.fn(),
    };

    next = vi.fn();

    config = {
      domain: "http://lindorm.io",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    };

    parseCookieHeader.mockReturnValue([
      {
        name: "cookie_name",
        signature: "cookie_signature",
        kid: "cookie_kid",
        value: "Y29va2llX3ZhbHVl",
      },
    ]);
    signCookie.mockResolvedValue({ signature: "signature", kid: "kid-1" });
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
    // The deployment NAMES the cookie enc key; pylon resolves that selector to a
    // CONCRETE kryptos and hands aegis that exact key — so aegis never reaches
    // its deployment-wide enc policy (which queries the published set and would
    // seal the cookie with the JWKS token key). We assert the RESOLVED key, not
    // the raw selector, because resolving-then-sealing is the whole fix.
    const cookieKey = KryptosKit.generate.auto({
      algorithm: "dir",
      issuer: "http://test.lindorm.io",
      publish: false,
      purpose: "cookie",
    });
    ctx.amphora.find.mockResolvedValue(cookieKey);

    next.mockImplementation(async () => {
      await ctx.cookies.set("new_cookie", "new_value", { encryption: true });
    });

    await expect(
      createHttpCookiesMiddleware({
        ...config,
        encryption: cookieKeys.encryption,
      })(ctx, next),
    ).resolves.toBeUndefined();

    expect(ctx.aegis.aes.encrypt).toHaveBeenCalledWith(
      "new_value",
      "tokenised",
      expect.objectContaining({ key: expect.objectContaining({ kryptos: cookieKey }) }),
    );

    const setCookieHeader = ctx.set.mock.calls[0][1][0] as string;
    const cookieValue = setCookieHeader.split("=")[1].split(";")[0];

    expect(AesKit.isAesTokenised(cookieValue)).toBe(true);
  });

  test("should pass the cookie signing key from the options to the signer", async () => {
    next.mockImplementation(async () => {
      ctx.cookies.set("new_cookie", "new_value", { signature: true });
    });

    await expect(
      createHttpCookiesMiddleware({
        ...config,
        signature: cookieKeys.signature,
      })(ctx, next),
    ).resolves.toBeUndefined();

    expect(signCookie).toHaveBeenCalledWith(
      ctx,
      expect.any(String),
      cookieKeys.signature,
    );
  });

  test("should derive the verification key from the configured signature predicate", async () => {
    next.mockImplementation(async () => {
      await ctx.cookies.get("cookie_name", { signed: true });
    });

    await expect(
      createHttpCookiesMiddleware({
        ...config,
        signature: cookieKeys.signature,
      })(ctx, next),
    ).resolves.toBeUndefined();

    // Verification is DERIVED from the signing selector's predicate — there is no
    // separate verification selector.
    expect(verifyCookie).toHaveBeenCalledWith(
      ctx,
      "cookie_name",
      "Y29va2llX3ZhbHVl",
      "cookie_signature",
      "cookie_kid",
      { predicate: cookieKeys.signature!.predicate },
    );
  });

  test("should set cookie with signature", async () => {
    next.mockImplementation(async () => {
      ctx.cookies.set("new_cookie", "new_value", { signature: true });
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.set).toHaveBeenCalledWith("set-cookie", [
      "new_cookie=bmV3X3ZhbHVl; domain=http://lindorm.io; path=/; samesite=strict; secure; httponly",
      "new_cookie.sig=signature; domain=http://lindorm.io; path=/; samesite=strict; secure; httponly",
      "new_cookie.kid=kid-1; domain=http://lindorm.io; path=/; samesite=strict; secure; httponly",
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
      {
        name: "cookie_name",
        signature: "cookie_signature",
        kid: "cookie_kid",
        value: "bmV3X3ZhbHVl",
      },
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
      {
        name: "cookie_name",
        signature: "cookie_signature",
        kid: "cookie_kid",
        value: tokenised,
      },
    ]);

    next.mockImplementation(async () => {
      await expect(ctx.cookies.get("cookie_name", { encrypted: true })).resolves.toEqual(
        "secret_value",
      );
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.aegis.aes.decrypt).toHaveBeenCalledWith(tokenised);
  });

  test("should get signed cookie", async () => {
    parseCookieHeader.mockReturnValue([
      {
        name: "cookie_name",
        signature: "cookie_signature",
        kid: "cookie_kid",
        value: "Y29va2llX3ZhbHVl",
      },
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
        kid: "cookie_kid",
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

  test("should delete cookie and expire its sig + kid companions", async () => {
    next.mockImplementation(async () => {
      ctx.cookies.del("cookie_name");
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.set).toHaveBeenCalledWith("set-cookie", [
      "cookie_name=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "cookie_name.sig=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "cookie_name.kid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ]);
  });

  test("should delete cookie without sig/kid when none are present", async () => {
    parseCookieHeader.mockReturnValue([
      {
        name: "cookie_name",
        signature: null,
        kid: null,
        value: "Y29va2llX3ZhbHVl",
      },
    ]);

    next.mockImplementation(async () => {
      ctx.cookies.del("cookie_name");
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.set).toHaveBeenCalledWith("set-cookie", [
      "cookie_name=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ]);
  });

  test("should emit single bare-name cookie for under-threshold value (backwards-compat)", async () => {
    next.mockImplementation(async () => {
      ctx.cookies.set("new_cookie", "x".repeat(500));
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    const setCookieHeader = ctx.set.mock.calls[0][1] as Array<string>;
    expect(setCookieHeader).toHaveLength(1);
    expect(setCookieHeader[0]).toMatch(/^new_cookie=/);
    expect(setCookieHeader[0]).not.toMatch(/^new_cookie\.0=/);
  });

  test("should chunk an over-threshold value into name.0, name.1, ... entries", async () => {
    next.mockImplementation(async () => {
      ctx.cookies.set("new_cookie", "x".repeat(10_000));
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    const headers = ctx.set.mock.calls[0][1] as Array<string>;
    expect(headers.length).toBeGreaterThan(1);
    expect(headers[0]).toMatch(/^new_cookie\.0=/);
    expect(headers[1]).toMatch(/^new_cookie\.1=/);
  });

  test("should chunk + sign producing single sig + kid covering joined value", async () => {
    next.mockImplementation(async () => {
      ctx.cookies.set("new_cookie", "x".repeat(10_000), { signature: true });
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    const headers = ctx.set.mock.calls[0][1] as Array<string>;

    const chunkHeaders = headers.filter((h) => /^new_cookie\.\d+=/.test(h));
    const sigHeaders = headers.filter((h) => h.startsWith("new_cookie.sig="));
    const kidHeaders = headers.filter((h) => h.startsWith("new_cookie.kid="));

    expect(chunkHeaders.length).toBeGreaterThan(1);
    expect(sigHeaders).toHaveLength(1);
    expect(kidHeaders).toHaveLength(1);

    expect(signCookie).toHaveBeenCalledTimes(1);
    const signedValue = signCookie.mock.calls[0][1] as string;

    const expectedEncoded = Buffer.from("x".repeat(10_000)).toString("base64url");
    expect(signedValue).toBe(expectedEncoded);

    const chunkPattern = /^new_cookie\.(\d+)=([^;]*)/;
    const reassembled = chunkHeaders
      .map((h) => chunkPattern.exec(h))
      .filter((m): m is RegExpExecArray => m !== null)
      .sort((a, b) => Number(a[1]) - Number(b[1]))
      .map((m) => m[2])
      .join("");
    expect(reassembled).toBe(signedValue);
  });

  // Byte-exact "tokenise first, THEN chunk" against REAL crypto: a mocked encrypt
  // cannot prove that the ciphertext survives chunking intact — only a real seal
  // reassembled and decrypted back to the plaintext does. The plaintext is large
  // enough that its ciphertext exceeds the chunk threshold.
  test("should AES-tokenise first, then chunk, with byte-exact round-trip", async () => {
    const logger = createMockLogger();
    const amphora = new Amphora({ domain: "http://test.lindorm.io", logger });
    const cookieKey = KryptosKit.generate.auto({
      algorithm: "dir",
      issuer: "http://test.lindorm.io",
      publish: false,
      purpose: "cookie",
    });
    amphora.add(cookieKey);

    const realCtx: any = {
      aegis: new Aegis({ amphora, logger }),
      amphora,
      get: vi.fn().mockReturnValue(""),
      set: vi.fn(),
    };

    const plaintext = "s".repeat(10_000);

    next.mockImplementation(async () => {
      await realCtx.cookies.set("new_cookie", plaintext, { encryption: true });
    });

    await expect(
      createHttpCookiesMiddleware({
        ...config,
        encryption: cookieKeys.encryption,
      })(realCtx, next),
    ).resolves.toBeUndefined();

    const headers = realCtx.set.mock.calls[0][1] as Array<string>;
    expect(headers.length).toBeGreaterThan(1);

    const chunkPattern = /^new_cookie\.(\d+)=([^;]*)/;
    const reassembled = headers
      .map((h) => chunkPattern.exec(h))
      .filter((m): m is RegExpExecArray => m !== null)
      .sort((a, b) => Number(a[1]) - Number(b[1]))
      .map((m) => m[2])
      .join("");

    // Chunking preserved the sealed token: it is still a valid AES token, sealed
    // with the NAMED cookie key, and decrypts back to the exact plaintext.
    expect(AesKit.isAesTokenised(reassembled)).toBe(true);
    expect(AesKit.parse(reassembled).keyId).toBe(cookieKey.id);
    await expect(realCtx.aegis.aes.decrypt(reassembled)).resolves.toBe(plaintext);
  });

  test("should expire stale chunks not produced by the new write", async () => {
    parseCookieHeader.mockReturnValue([
      {
        name: "new_cookie",
        signature: null,
        kid: null,
        value: "stalevalue",
        chunkIndices: [0, 1, 2, 3, 4],
      },
    ]);

    next.mockImplementation(async () => {
      ctx.cookies.set("new_cookie", "y".repeat(8_000));
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    const headers = ctx.set.mock.calls[0][1] as Array<string>;
    const chunkHeaders = headers.filter((h) => /^new_cookie\.\d+=/.test(h));

    const liveChunks = chunkHeaders.filter(
      (h) => !h.includes("expires=Thu, 01 Jan 1970"),
    );
    const expiredChunks = chunkHeaders.filter((h) =>
      h.includes("expires=Thu, 01 Jan 1970"),
    );

    expect(liveChunks.length).toBeGreaterThanOrEqual(1);

    const liveIndices = liveChunks
      .map((h) => /^new_cookie\.(\d+)=/.exec(h)?.[1])
      .filter((idx): idx is string => idx !== undefined)
      .map(Number);

    const expiredIndices = expiredChunks
      .map((h) => /^new_cookie\.(\d+)=/.exec(h)?.[1])
      .filter((idx): idx is string => idx !== undefined)
      .map(Number);

    for (const stale of [0, 1, 2, 3, 4]) {
      if (!liveIndices.includes(stale)) {
        expect(expiredIndices).toContain(stale);
      }
    }
  });

  test("should expire all chunks plus sig + kid on del", async () => {
    parseCookieHeader.mockReturnValue([
      {
        name: "cookie_name",
        signature: "sigval",
        kid: "kidval",
        value: "joined",
        chunkIndices: [0, 1, 2],
      },
    ]);

    next.mockImplementation(async () => {
      ctx.cookies.del("cookie_name");
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    expect(ctx.set).toHaveBeenCalledWith("set-cookie", [
      "cookie_name=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "cookie_name.0=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "cookie_name.1=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "cookie_name.2=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "cookie_name.sig=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT",
      "cookie_name.kid=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ]);
  });

  test("should honor chunked: false opt-out", async () => {
    next.mockImplementation(async () => {
      ctx.cookies.set("new_cookie", "x".repeat(10_000), { chunked: false });
    });

    await expect(createHttpCookiesMiddleware(config)(ctx, next)).resolves.toBeUndefined();

    const headers = ctx.set.mock.calls[0][1] as Array<string>;
    expect(headers).toHaveLength(1);
    expect(headers[0]).toMatch(/^new_cookie=/);
    expect(headers[0]).not.toMatch(/^new_cookie\.0=/);
  });
});
