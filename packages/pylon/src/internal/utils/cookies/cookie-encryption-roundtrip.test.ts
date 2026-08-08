import { Aegis } from "@lindorm/aegis";
import { AesKit } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test } from "vitest";
import type {
  PylonCookieSettings,
  PylonEncKey,
  PylonGetCookieOptions,
} from "../../../types/index.js";
import { createGetCookie } from "./create-get-cookie.js";
import { encryptCookie } from "./encrypt-cookie.js";

const ISSUER = "http://test.lindorm.io";

/**
 * The whole cookie seal → read path on REAL aegis/amphora, with a cookie key
 * whose declared algorithm is neither aegis's floor nor anything pylon names.
 * Both ends have to reach it through the key alone: the write side has no AEAD
 * to hand over, and the read side has no key to name.
 */
describe("cookie encryption round-trip", () => {
  let amphora: IAmphora;
  let ctx: any;

  const key: PylonEncKey = { condition: { purpose: "cookie", publish: false } };
  const config: PylonCookieSettings = { encoding: undefined } as PylonCookieSettings;

  beforeEach(() => {
    const logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    ctx = { aegis: new Aegis({ amphora, logger }), amphora };
  });

  test.each(["A192CBC-HS384", "A128GCM"] as const)(
    "seals under the key's %s and reads back with no key named",
    async (encryption) => {
      amphora.add(
        KryptosKit.generate.auto({
          algorithm: "dir",
          encryption,
          issuer: ISSUER,
          publish: false,
          purpose: "cookie",
        }),
      );

      const sealed = await encryptCookie(ctx, "secret_value", key);

      expect(AesKit.parse(sealed).encryption).toBe(encryption);

      const getCookie = createGetCookie({
        ctx,
        config,
        parsed: [{ name: "session", signature: null, kid: null, value: sealed }],
      });

      await expect(getCookie("session", { encrypted: true })).resolves.toBe(
        "secret_value",
      );
    },
  );

  // THE DEFAULT, end to end. A vault holding NOTHING but the internal
  // unpublished cookie key — which is what a real deployment's cookie key is —
  // and a selector that names only the purpose. Amphora's publish gate hides
  // exactly this key from a query naming no `publish`, so without the envelope
  // default the seal cannot resolve a key at all.
  test("seals and reopens with an internal unpublished key the selector never mentions", async () => {
    const cookieKey = KryptosKit.generate.auto({
      algorithm: "dir",
      encryption: "A256GCM",
      issuer: ISSUER,
      publish: false,
      purpose: "cookie",
    });

    amphora.add(cookieKey);

    const sealed = await encryptCookie(ctx, "secret_value", {
      condition: { purpose: "cookie" },
    });

    expect(AesKit.parse(sealed).keyId).toBe(cookieKey.id);

    const getCookie = createGetCookie({
      ctx,
      config,
      parsed: [{ name: "session", signature: null, kid: null, value: sealed }],
    });

    await expect(getCookie("session", { encrypted: true })).resolves.toBe("secret_value");
  });

  // The default yields: a deployment that deliberately seals with a published
  // key says so, and gets it — `publish` stays consumer policy.
  test("a selector stating publish: true still reaches a published key", async () => {
    const published = KryptosKit.generate.auto({
      algorithm: "dir",
      encryption: "A256GCM",
      issuer: ISSUER,
      publish: true,
      purpose: "cookie",
    });

    amphora.add(published);

    const sealed = await encryptCookie(ctx, "secret_value", {
      condition: { purpose: "cookie", publish: true },
    });

    expect(AesKit.parse(sealed).keyId).toBe(published.id);
    await expect(ctx.aegis.aes.decrypt(sealed)).resolves.toBe("secret_value");
  });

  // A key-WRAPPING cookie key: the content-encryption key is generated per
  // message, so a wrong AEAD would seal happily and only the wire shows it.
  test("a wrapping cookie key's declaration reaches the wire too", async () => {
    amphora.add(
      KryptosKit.generate.auto({
        algorithm: "A256KW",
        encryption: "A128CBC-HS256",
        issuer: ISSUER,
        publish: false,
        purpose: "cookie",
      }),
    );

    const sealed = await encryptCookie(ctx, "secret_value", key);

    expect(AesKit.parse(sealed).encryption).toBe("A128CBC-HS256");
    await expect(ctx.aegis.aes.decrypt(sealed)).resolves.toBe("secret_value");
  });

  // The two halves of the surface, asserted at COMPILE time. Neither side has
  // anything to say about the cipher, so neither side accepts anything.
  test("neither side accepts what it cannot use", () => {
    const writeKey: PylonEncKey = {
      condition: { purpose: "cookie" },
      // @ts-expect-error the write-side selector names the KEY, never the AEAD
      encryption: "A256GCM",
    };
    // @ts-expect-error the read side takes no selector — the ciphertext names its own key
    const readOptions: PylonGetCookieOptions = { encrypted: { condition: {} } };

    expect(writeKey.condition).toEqual({ purpose: "cookie" });
    expect(readOptions.encrypted).toBeTruthy();
  });
});
