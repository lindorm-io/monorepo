import { Aegis } from "@lindorm/aegis";
import { AesKit } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test } from "vitest";
import type { PylonEncKey } from "../../../types/index.js";
import { encryptCookie } from "./encrypt-cookie.js";

const ISSUER = "http://test.lindorm.io";

const cookieEncKey = (): IKryptos =>
  KryptosKit.generate.auto({
    algorithm: "dir",
    issuer: ISSUER,
    publish: false,
    purpose: "cookie",
  });

// Deliberately NEWER than the cookie key — the newest match a vacuous selector
// would grab. Naming the cookie key is what keeps this out of the ciphertext.
const publishedTokenEncKey = (): IKryptos =>
  KryptosKit.generate.auto({
    algorithm: "ECDH-ES+A256GCMKW",
    createdAt: new Date("2999-01-01T00:00:00.000Z"),
    curve: "X448",
    issuer: ISSUER,
    publish: true,
    purpose: "token",
  });

describe("encryptCookie", () => {
  let amphora: IAmphora;
  let ctx: any;

  beforeEach(() => {
    const logger = createMockLogger();
    amphora = new Amphora({ domain: ISSUER, logger });
    ctx = { aegis: new Aegis({ amphora, logger }), amphora };
  });

  const key: PylonEncKey = {
    predicate: { purpose: "cookie", publish: false },
  };

  test("resolves the named key and seals the value as an AES token with THAT key's kid", async () => {
    const cookieKey = cookieEncKey();
    const tokenKey = publishedTokenEncKey();

    amphora.add([cookieKey, tokenKey]);

    const sealed = await encryptCookie(ctx, "secret_value", key);

    expect(AesKit.isAesTokenised(sealed)).toBe(true);
    expect(AesKit.parse(sealed).keyId).toBe(cookieKey.id);
    expect(AesKit.parse(sealed).keyId).not.toBe(tokenKey.id);
  });

  test("round-trips: the sealed value decrypts back to the plaintext", async () => {
    amphora.add([cookieEncKey(), publishedTokenEncKey()]);

    const sealed = await encryptCookie(ctx, "secret_value", key);

    await expect(ctx.aegis.aes.decrypt(sealed)).resolves.toBe("secret_value");
  });

  // The resolver's throw is the point of the fail-closed contract — it must
  // propagate, never fall back to sealing with the published token key.
  test("propagates the resolver throw when no key is configured", async () => {
    amphora.add([publishedTokenEncKey()]);

    await expect(encryptCookie(ctx, "secret_value", undefined)).rejects.toMatchObject({
      code: "cookie_encryption_key_not_configured",
    });
  });

  test("propagates the resolver throw when the named key is not in the vault", async () => {
    amphora.add([publishedTokenEncKey()]);

    await expect(encryptCookie(ctx, "secret_value", key)).rejects.toMatchObject({
      code: "cookie_encryption_key_not_found",
    });
  });
});
