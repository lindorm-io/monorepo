import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test } from "vitest";
import type { PylonEncKey } from "../../../types/index.js";
import { resolveCookieEncryptionKey } from "./resolve-cookie-encryption-key.js";

const ISSUER = "http://test.lindorm.io";

const OLDER = new Date("2024-01-01T00:00:00.000Z");
const NEWER = new Date("2024-06-01T00:00:00.000Z");

// A `dir` key is symmetric: use "enc", a secret half in the private slot, active.
// It satisfies the ENVELOPE floor — the key that seals a self-opened cookie.
const cookieEncKey = (): IKryptos =>
  KryptosKit.generate.auto({
    algorithm: "dir",
    createdAt: OLDER,
    issuer: ISSUER,
    publish: false,
    purpose: "cookie",
  });

// Deliberately NEWER: `amphora.find` returns the newest match, so a vacuous
// selector would resolve to THIS published token key — the very bug the resolver
// exists to prevent.
const publishedTokenEncKey = (): IKryptos =>
  KryptosKit.generate.auto({
    algorithm: "ECDH-ES+A256GCMKW",
    createdAt: NEWER,
    curve: "X448",
    issuer: ISSUER,
    publish: true,
    purpose: "token",
  });

describe("resolveCookieEncryptionKey", () => {
  let amphora: IAmphora;

  beforeEach(() => {
    amphora = new Amphora({ domain: ISSUER, logger: createMockLogger() });
  });

  // The magic is GONE, not moved: with no selector there is nothing to select
  // with, and the floor alone would query amphora's default (published) set and
  // hand back the JWKS token key.
  test("throws when the selector is undefined", async () => {
    await expect(resolveCookieEncryptionKey(amphora, undefined)).rejects.toMatchObject({
      code: "cookie_encryption_key_not_configured",
    });
  });

  test("throws when the selector carries neither kryptos nor condition", async () => {
    await expect(
      resolveCookieEncryptionKey(amphora, {} as PylonEncKey),
    ).rejects.toMatchObject({ code: "cookie_encryption_key_not_configured" });
  });

  describe("key selection (real vault)", () => {
    test("selects the internal cookie enc key the condition names, NOT the newer published token key", async () => {
      const cookieKey = cookieEncKey();
      const tokenKey = publishedTokenEncKey();

      amphora.add([cookieKey, tokenKey]);

      const resolved = await resolveCookieEncryptionKey(amphora, {
        condition: { purpose: "cookie", publish: false },
      });

      expect(resolved.id).toBe(cookieKey.id);
      expect(resolved.id).not.toBe(tokenKey.id);
    });

    test("the selected key satisfies the envelope floor and the condition", async () => {
      amphora.add([cookieEncKey(), publishedTokenEncKey()]);

      const resolved = await resolveCookieEncryptionKey(amphora, {
        condition: { purpose: "cookie", publish: false },
      });

      expect(resolved.use).toBe("enc");
      expect(resolved.hasPrivateKey).toBe(true);
      expect(resolved.isActive).toBe(true);
      expect(resolved.purpose).toBe("cookie");
      expect(resolved.publish).toBe(false);
    });

    // An injected key skips the vault entirely.
    test("honours an injected kryptos without touching the vault", async () => {
      const injected = cookieEncKey();

      amphora.add([publishedTokenEncKey()]);

      const resolved = await resolveCookieEncryptionKey(amphora, { kryptos: injected });

      expect(resolved.id).toBe(injected.id);
    });

    // Fail LOUDLY: a named key the vault does not hold must not degrade into
    // "whatever enc key is newest".
    test("throws when no key matches the configured condition", async () => {
      amphora.add([publishedTokenEncKey()]);

      await expect(
        resolveCookieEncryptionKey(amphora, {
          condition: { purpose: "cookie", publish: false },
        }),
      ).rejects.toMatchObject({ code: "cookie_encryption_key_not_found" });
    });

    // The post-check floor is only reachable via an INJECTED key: a vault query
    // already carries the floor, so anything it returns passes. Injection is how
    // a key that violates the floor reaches the resolver.
    test("throws policy violation when an injected key has the wrong use (sig)", async () => {
      const sigKey = KryptosKit.generate.auto({
        algorithm: "HS256",
        issuer: ISSUER,
        publish: false,
        purpose: "cookie",
      });

      await expect(
        resolveCookieEncryptionKey(amphora, { kryptos: sigKey }),
      ).rejects.toMatchObject({ code: "cookie_encryption_key_policy_violation" });
    });

    test("throws policy violation when an injected enc key is expired (not active)", async () => {
      const expired = KryptosKit.generate.auto({
        algorithm: "dir",
        issuer: ISSUER,
        publish: false,
        purpose: "cookie",
        notBefore: new Date("2020-01-01T00:00:00.000Z"),
        expiresAt: new Date("2020-06-01T00:00:00.000Z"),
      });

      expect(expired.isActive).toBe(false);

      await expect(
        resolveCookieEncryptionKey(amphora, { kryptos: expired }),
      ).rejects.toMatchObject({ code: "cookie_encryption_key_policy_violation" });
    });

    test("throws policy violation when an injected enc key is not yet active", async () => {
      const pending = KryptosKit.generate.auto({
        algorithm: "dir",
        issuer: ISSUER,
        publish: false,
        purpose: "cookie",
        notBefore: new Date("2999-01-01T00:00:00.000Z"),
        expiresAt: new Date("2999-06-01T00:00:00.000Z"),
      });

      expect(pending.isActive).toBe(false);

      await expect(
        resolveCookieEncryptionKey(amphora, { kryptos: pending }),
      ).rejects.toMatchObject({ code: "cookie_encryption_key_policy_violation" });
    });
  });
});
