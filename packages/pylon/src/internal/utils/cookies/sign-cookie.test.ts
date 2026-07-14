import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { signCookie } from "./sign-cookie.js";

vi.mock("@lindorm/aegis", async () => ({
  ...(await vi.importActual<typeof import("@lindorm/aegis")>("@lindorm/aegis")),
  SignatureKit: class SignatureKit {
    format(value: any): string {
      return "formatted_" + value;
    }
    sign(value: string): string {
      return "signed_" + value;
    }
  },
}));

describe("signCookie", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = { amphora: createMockAmphora() };
    ctx.amphora.find.mockResolvedValue({ id: "kid-1" });
  });

  test("should return signed value and kid", async () => {
    await expect(signCookie(ctx, "value")).resolves.toStrictEqual({
      signature: "formatted_signed_value",
      kid: "kid-1",
    });
  });

  // The mocked-amphora test above proves the SHAPE. These prove the SELECTION —
  // against a real vault, with a real predicate, because the predicate is the
  // whole point: a cookie must be signed by an internal cookie/session key and
  // never by a published token key.
  describe("key selection (real vault)", () => {
    const older = new Date("2024-01-01T00:00:00.000Z");
    const newer = new Date("2024-06-01T00:00:00.000Z");

    let amphora: IAmphora;

    const internalCookieKey = () =>
      KryptosKit.generate.auto({
        algorithm: "HS256",
        createdAt: older,
        issuer: "http://test.lindorm.io",
        publish: false,
        purpose: "cookie",
      });

    // Deliberately NEWER than the cookie key. `amphora.find` returns the newest
    // match, so if the predicate were vacuous this key would win — which is
    // exactly the bug that existed: pylon was signing cookies with its
    // token-signing key, because token keys rotate every 6mo and cookie keys
    // yearly, making the token key almost always the newest sig key.
    const publishedTokenKey = () =>
      KryptosKit.generate.auto({
        algorithm: "EdDSA",
        createdAt: newer,
        curve: "Ed25519",
        issuer: "http://test.lindorm.io",
        publish: true,
        purpose: "token",
      });

    beforeEach(() => {
      amphora = new Amphora({
        domain: "http://test.lindorm.io",
        logger: createMockLogger(),
      });
    });

    test("selects the internal cookie key, NOT the newer published token key", async () => {
      const cookieKey = internalCookieKey();
      const tokenKey = publishedTokenKey();

      amphora.add([cookieKey, tokenKey]);

      const { kid } = await signCookie({ amphora }, "value");

      expect(kid).toBe(cookieKey.id);
      expect(kid).not.toBe(tokenKey.id);
    });

    test("selects an internal session key when no cookie key exists", async () => {
      const sessionKey = KryptosKit.generate.auto({
        algorithm: "EdDSA",
        createdAt: older,
        curve: "Ed448",
        issuer: "http://test.lindorm.io",
        publish: false,
        purpose: "session",
      });

      amphora.add([sessionKey, publishedTokenKey()]);

      const { kid } = await signCookie({ amphora }, "value");

      expect(kid).toBe(sessionKey.id);
    });

    test("the selected key is internal and purpose-scoped", async () => {
      amphora.add([internalCookieKey(), publishedTokenKey()]);

      const { kid } = await signCookie({ amphora }, "value");
      const selected = amphora.findByIdSync(kid);

      expect(selected.publish).toBe(false);
      expect(selected.purpose).toBe("cookie");
      expect(selected.use).toBe("sig");
      expect(selected.hasPrivateKey).toBe(true);
    });

    // Fail closed: no cookie/session sig key means no cookie signing. Falling back
    // to "whatever sig key is newest" is how the token key got used in the first
    // place — a purposeless fallback is worse than a loud failure.
    test("throws when only a published token key exists", async () => {
      amphora.add([publishedTokenKey()]);

      await expect(signCookie({ amphora }, "value")).rejects.toThrow();
    });
  });
});
