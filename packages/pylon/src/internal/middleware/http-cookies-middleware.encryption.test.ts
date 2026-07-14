import { Aegis } from "@lindorm/aegis";
import { AesKit } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PylonKeys } from "../../types/index.js";
import { createHttpCookiesMiddleware } from "./http-cookies-middleware.js";

/**
 * Cookie ENCRYPTION, against a REAL vault and a REAL aegis.
 *
 * A mocked `find` cannot select the wrong key — which is precisely why this bug
 * survived: `ctx.aegis.aes.encrypt(value, "tokenised")` took no selector, so it
 * resolved through aegis's deployment-wide enc policy. Amphora queries the
 * PUBLISHED set by default, so the internal `dir` cookie key that exists for
 * exactly this job was unreachable and the JWKS token key sealed every cookie.
 *
 * The token key here is deliberately NEWER than the cookie key: `amphora.find`
 * returns the newest match, so a vacuous selector resolves to it. That is what
 * makes this test able to fail.
 */
const OLDER = new Date("2024-01-01T00:00:00.000Z");
const NEWER = new Date("2024-06-01T00:00:00.000Z");

const ISSUER = "http://test.lindorm.io";

const cookieEncKey = (): IKryptos =>
  KryptosKit.generate.auto({
    algorithm: "dir",
    createdAt: OLDER,
    issuer: ISSUER,
    publish: false,
    purpose: "cookie",
  });

const publishedTokenEncKey = (): IKryptos =>
  KryptosKit.generate.auto({
    algorithm: "ECDH-ES+A256GCMKW",
    createdAt: NEWER,
    curve: "X448",
    issuer: ISSUER,
    publish: true,
    purpose: "token",
  });

const keys: PylonKeys = {
  cookieEncryption: { predicate: { purpose: "cookie", publish: false } },
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

const setCookieValue = (ctx: ReturnType<typeof buildCtx>): string => {
  const [header] = ctx.set.mock.calls[0][1] as Array<string>;
  return header.split("=")[1].split(";")[0];
};

describe("httpCookiesMiddleware — encryption key selection (real vault)", () => {
  let amphora: IAmphora;
  let cookieKey: IKryptos;
  let tokenKey: IKryptos;

  beforeEach(() => {
    amphora = new Amphora({ domain: ISSUER, logger: createMockLogger() });

    cookieKey = cookieEncKey();
    tokenKey = publishedTokenEncKey();

    amphora.add([cookieKey, tokenKey]);
  });

  test("seals the cookie with the INTERNAL cookie key, not the newer PUBLISHED token key", async () => {
    const ctx = buildCtx(amphora);

    await createHttpCookiesMiddleware({}, keys)(ctx as any, async () => {
      await (ctx as any).cookies.set("sid", "secret_value", { encrypted: true });
    });

    const { keyId } = AesKit.parse(setCookieValue(ctx));

    expect(keyId).toBe(cookieKey.id);
    expect(keyId).not.toBe(tokenKey.id);
  });

  // The regression guard: with no selector, aegis's default enc policy queries
  // the published set and the token key — newer — wins. This is the old
  // behaviour, asserted so the fix cannot silently revert.
  test("without the selector it falls back to the published token key", async () => {
    const ctx = buildCtx(amphora);

    await createHttpCookiesMiddleware({})(ctx as any, async () => {
      await (ctx as any).cookies.set("sid", "secret_value", { encrypted: true });
    });

    const { keyId } = AesKit.parse(setCookieValue(ctx));

    expect(keyId).toBe(tokenKey.id);
  });

  // Ciphertext names its own key, so aegis resolves the read side by kid. A
  // cookie sealed with the token key BEFORE this change still decrypts after it,
  // even though the deployment now writes with the cookie key.
  test("a cookie sealed with the OLD key still decrypts", async () => {
    const writeCtx = buildCtx(amphora);

    // Exactly what the old code produced: the published token enc key.
    const stale = await writeCtx.aegis.aes.encrypt("old_value", "tokenised", {
      predicate: { purpose: "token" },
    });

    expect(AesKit.parse(stale).keyId).toBe(tokenKey.id);

    const readCtx = buildCtx(amphora, `sid=${stale}`);

    let read: unknown;

    await createHttpCookiesMiddleware({}, keys)(readCtx as any, async () => {
      read = await (readCtx as any).cookies.get("sid");
    });

    expect(read).toBe("old_value");
  });

  // Fail LOUDLY, not silently: a deployment that names a key the vault does not
  // hold must not quietly fall back to whatever else is lying around.
  test("throws when the named cookie enc key is not in the vault", async () => {
    const ctx = buildCtx(amphora);

    await expect(
      createHttpCookiesMiddleware(
        {},
        { cookieEncryption: { predicate: { purpose: "no-such-purpose" } } },
      )(ctx as any, async () => {
        await (ctx as any).cookies.set("sid", "secret_value", { encrypted: true });
      }),
    ).rejects.toThrow();

    expect(ctx.set).not.toHaveBeenCalled();
  });
});
