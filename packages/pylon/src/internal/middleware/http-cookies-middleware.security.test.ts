import { Aegis } from "@lindorm/aegis";
import { AesKit } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { ClientError } from "@lindorm/errors";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PylonCookieConfig, PylonKeys } from "../../types/index.js";
import { createHttpCookiesMiddleware } from "./http-cookies-middleware.js";

/**
 * The cookie READ path, against a REAL vault and a REAL aegis.
 *
 * The bug this pins: the read path chose decrypt-vs-plaintext by SNIFFING the
 * client's value (`isAesTokenised`), not by the declared policy. Composed with
 * pylon's own login cookie — written encrypted, read by a bare `get()` — it was
 * an OAuth login hijack + open redirect: plant an unsealed JSON blob and the
 * reader served it back as trusted plaintext (attacker-chosen `state` /
 * `redirectUri`). These tests assert the security PROPERTY — policy is the
 * authority — not the old observed output.
 */
const ISSUER = "http://test.lindorm.io";

const cookieSignKey = (): IKryptos =>
  KryptosKit.generate.auto({
    algorithm: "HS256",
    issuer: ISSUER,
    publish: false,
    purpose: "cookie",
  });

const cookieEncKey = (): IKryptos =>
  KryptosKit.generate.auto({
    algorithm: "dir",
    issuer: ISSUER,
    publish: false,
    purpose: "cookie",
  });

const keys: PylonKeys = {
  cookie: {
    signature: { predicate: { purpose: "cookie", publish: false } },
    encryption: { predicate: { purpose: "cookie", publish: false } },
  },
};

const buildCtx = (amphora: IAmphora, cookieHeader = "") => {
  const logger = createMockLogger();

  return {
    aegis: new Aegis({ amphora, logger }),
    amphora,
    get: vi.fn().mockReturnValue(cookieHeader),
    set: vi.fn(),
  };
};

const extractNameValue = (header: string): string => {
  const idx = header.indexOf(";");
  return (idx === -1 ? header : header.slice(0, idx)).trim();
};

const toCookieHeader = (headers: Array<string>): string =>
  headers.filter(Boolean).map(extractNameValue).join("; ");

describe("httpCookiesMiddleware — read-path policy enforcement (real vault)", () => {
  let amphora: IAmphora;
  let config: PylonCookieConfig;

  beforeEach(() => {
    amphora = new Amphora({ domain: ISSUER, logger: createMockLogger() });
    amphora.add([cookieSignKey(), cookieEncKey()]);
    config = {};
  });

  const write = async (
    name: string,
    value: unknown,
    options: any,
    cfg: PylonCookieConfig = config,
  ): Promise<Array<string>> => {
    const ctx = buildCtx(amphora);

    await createHttpCookiesMiddleware(cfg, keys)(ctx as any, async () => {
      await (ctx as any).cookies.set(name, value, options);
    });

    return (ctx.set.mock.calls[0]?.[1] ?? []) as Array<string>;
  };

  const read = async <T = unknown>(
    cookieHeader: string,
    name: string,
    options: any,
    cfg: PylonCookieConfig = config,
  ): Promise<T> => {
    const ctx = buildCtx(amphora, cookieHeader);

    let out: unknown;
    await createHttpCookiesMiddleware(cfg, keys)(ctx as any, async () => {
      out = await (ctx as any).cookies.get(name, options);
    });

    return out as T;
  };

  // A base64url JSON blob is exactly what an attacker plants: not `aes:`-prefixed,
  // so the old sniff decoded it as plaintext. It is NOT aes-tokenised.
  const forgedUnsealed = (payload: unknown): string => {
    const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(AesKit.isAesTokenised(value)).toBe(false);
    return value;
  };

  test("an encrypted cookie round-trips under an encrypted read", async () => {
    const value = { redirectUri: "https://client.example/app", state: "s-123" };

    const headers = await write("session", value, { encrypted: true });
    expect(AesKit.isAesTokenised(extractNameValue(headers[0]).split("=")[1])).toBe(true);

    const result = await read(toCookieHeader(headers), "session", { encrypted: true });

    expect(result).toEqual(value);
  });

  test("a forged UNSEALED value under an encrypted policy is REJECTED, not served as plaintext", async () => {
    const attacker = {
      redirectUri: "https://evil.example/steal",
      state: "attacker-state",
    };

    const cookieHeader = `session=${forgedUnsealed(attacker)}`;

    // The exploit path: the reader must THROW, never hand back attacker plaintext.
    await expect(read(cookieHeader, "session", { encrypted: true })).rejects.toThrow(
      ClientError,
    );

    await expect(
      read(cookieHeader, "session", { encrypted: true }),
    ).rejects.toMatchObject({
      code: "cookie_not_encrypted",
      status: ClientError.Status.Unauthorized,
    });
  });

  test("encrypted:false read of a tokenised-looking value is treated as plaintext, NOT decrypted", async () => {
    const value = { secret: "do-not-decrypt" };

    // A genuinely sealed value, then read under a FALSY encrypted policy.
    const headers = await write("session", value, { encrypted: true });
    const sealed = extractNameValue(headers[0]).split("=")[1];
    expect(AesKit.isAesTokenised(sealed)).toBe(true);

    const result = await read(toCookieHeader(headers), "session", { encrypted: false });

    // Policy, not the byte prefix: it was NOT decrypted — the object never came
    // back. Had the reader sniffed, `result` would equal `value`.
    expect(result).not.toEqual(value);
    expect(typeof result).not.toBe("object");
  });

  test("a signed cookie round-trips, and a tampered value fails verification", async () => {
    const value = { redirectUri: "https://client.example/app", state: "s-777" };

    const headers = await write("session", value, { signed: true });
    const cookieHeader = toCookieHeader(headers);

    await expect(read(cookieHeader, "session", { signed: true })).resolves.toEqual(value);

    // Flip the payload cookie, keep the (now-stale) signature + kid.
    const tampered = cookieHeader.replace(
      /session=[^;]+/,
      `session=${forgedUnsealed({ redirectUri: "https://evil.example", state: "x" })}`,
    );

    await expect(read(tampered, "session", { signed: true })).rejects.toThrow(
      ClientError,
    );
  });

  test("login flow: a signed+encrypted login cookie round-trips; a forged one is rejected before its state/redirectUri is trusted", async () => {
    const loginCookie = {
      codeChallengeMethod: "S256",
      codeVerifier: "verifier-abc",
      nonce: "nonce-abc",
      redirectUri: "https://client.example/callback",
      responseType: "code",
      scope: "openid",
      state: "state-abc",
    };

    const headers = await write("pylon_login_session", loginCookie, {
      signed: true,
      encrypted: true,
    });

    // Round-trip: the callback reads it under the SAME policy and recovers it.
    await expect(
      read(toCookieHeader(headers), "pylon_login_session", {
        signed: true,
        encrypted: true,
      }),
    ).resolves.toEqual(loginCookie);

    // Forged: attacker plants an UNSIGNED, UNSEALED cookie with their own state
    // and redirectUri. No `.sig`/`.kid` present ⇒ signature check throws FIRST,
    // so the callback never trusts the attacker's values.
    const forged = `pylon_login_session=${forgedUnsealed({
      redirectUri: "https://evil.example/steal",
      responseType: "code",
      state: "attacker-state",
    })}`;

    await expect(
      read(forged, "pylon_login_session", { signed: true, encrypted: true }),
    ).rejects.toThrow(ClientError);
  });

  test("a deployment-wide signed:true in PylonCookieConfig reaches the middleware", async () => {
    // Compile-level: PylonCookieConfig now accepts signed/encrypted.
    const deploymentConfig: PylonCookieConfig = { signed: true, encrypted: false };

    const headers = await write(
      "session",
      { state: "cfg-signed" },
      { encoding: "base64url" },
      deploymentConfig,
    );

    // Behavioural: config-level `signed` produced the signature artifacts...
    expect(headers.some((h) => h.startsWith("session.sig="))).toBe(true);
    expect(headers.some((h) => h.startsWith("session.kid="))).toBe(true);

    // ...and the read side, under the same config, verifies and returns it.
    await expect(
      read(
        toCookieHeader(headers),
        "session",
        { encoding: "base64url" },
        deploymentConfig,
      ),
    ).resolves.toEqual({ state: "cfg-signed" });
  });
});
