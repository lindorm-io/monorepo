import { AesKit } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test } from "vitest";
import { Aegis } from "./Aegis.js";

const ISSUER = "https://test.lindorm.io/";
const PLAINTEXT = "cookie-session-payload";

/**
 * A key that DECLARES an `encryption` states what it is, and aegis honours it.
 * Every key here declares something OTHER than `A256GCM`, so a kit- or
 * deployment-level default that still won would be visible on the wire.
 *
 * The two families answer differently and are therefore both covered:
 *
 *   `dir`     — the declaration is BINDING. The secret is sized for it (a
 *               48-byte secret is `A192CBC-HS384` and nothing else), so
 *               overriding it does not pick another cipher, it fails.
 *   WRAPPING  — the declaration is a STATEMENT. The content-encryption key is
 *               generated per message, so any AEAD would "work" — which is
 *               exactly why an override here is silent rather than loud.
 */
const DIR_KEY = KryptosKit.generate.auto({
  algorithm: "dir",
  encryption: "A192CBC-HS384",
  purpose: "cookie",
  publish: false,
  internal: true,
});

const WRAP_KEY = KryptosKit.generate.auto({
  algorithm: "A256KW",
  encryption: "A128GCM",
  purpose: "cookie-wrap",
  publish: false,
  internal: true,
});

describe("Aegis honours the key's declared encryption", () => {
  let logger: ILogger;
  let amphora: IAmphora;

  const aegisFor = (defaultEncryption?: "A256GCM" | "A128GCM"): Aegis =>
    new Aegis({ amphora, logger, ...(defaultEncryption ? { defaultEncryption } : {}) });

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    await amphora.setup();
  });

  describe.each<[string, IKryptos, string]>([
    ["dir", DIR_KEY, "A192CBC-HS384"],
    ["wrapping", WRAP_KEY, "A128GCM"],
  ])("%s key", (_family, kryptos, declared) => {
    test("seals with the key's algorithm and round-trips", async () => {
      const aegis = aegisFor();
      amphora.add(kryptos);

      const sealed = await aegis.aes.encrypt(PLAINTEXT, { key: { kryptos } });

      expect(AesKit.parse(sealed).encryption).toBe(declared);
      await expect(aegis.aes.decrypt(sealed)).resolves.toBe(PLAINTEXT);
    });

    test("the deployment default does not override the declaration", async () => {
      const aegis = aegisFor("A256GCM");
      amphora.add(kryptos);

      const sealed = await aegis.aes.encrypt(PLAINTEXT, { key: { kryptos } });

      expect(AesKit.parse(sealed).encryption).toBe(declared);
      await expect(aegis.aes.decrypt(sealed)).resolves.toBe(PLAINTEXT);
    });

    test("a vault-resolved key is honoured the same as an injected one", async () => {
      const aegis = aegisFor("A256GCM");
      amphora.add(kryptos);

      // `publish: false` is what makes an internal key reachable at all —
      // amphora's default query is the published set.
      const sealed = await aegis.aes.encrypt(PLAINTEXT, {
        key: { condition: { id: kryptos.id, publish: false } },
      });

      expect(AesKit.parse(sealed).keyId).toBe(kryptos.id);
      expect(AesKit.parse(sealed).encryption).toBe(declared);
      await expect(aegis.aes.decrypt(sealed)).resolves.toBe(PLAINTEXT);
    });
  });

  // The fallback's ONLY job: a recipient key that declares nothing — an
  // imported peer JWK carries no `enc`, it is not a standard JWK member. It is
  // a fallback, never an override, which is why it cannot conflict.
  describe("a key that declares nothing", () => {
    test("falls back to the deployment default", async () => {
      const aegis = aegisFor("A128GCM");
      const bare = KryptosKit.from.jwk({
        ...WRAP_KEY.toJWK("private"),
        enc: undefined,
      });
      amphora.add(bare);

      const sealed = await aegis.aes.encrypt(PLAINTEXT, { key: { kryptos: bare } });

      expect(bare.encryption).toBeNull();
      expect(AesKit.parse(sealed).encryption).toBe("A128GCM");
      await expect(aegis.aes.decrypt(sealed)).resolves.toBe(PLAINTEXT);
    });

    test("falls back to A256GCM when the deployment names none", async () => {
      const aegis = aegisFor();
      const bare = KryptosKit.from.jwk({
        ...WRAP_KEY.toJWK("private"),
        enc: undefined,
      });
      amphora.add(bare);

      const sealed = await aegis.aes.encrypt(PLAINTEXT, { key: { kryptos: bare } });

      expect(AesKit.parse(sealed).encryption).toBe("A256GCM");
      await expect(aegis.aes.decrypt(sealed)).resolves.toBe(PLAINTEXT);
    });
  });
});
