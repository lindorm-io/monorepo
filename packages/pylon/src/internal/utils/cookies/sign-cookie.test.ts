import { Amphora, type IAmphora } from "@lindorm/amphora";
import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { PylonSignKey } from "../../../types/index.js";
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

// The deployment's selector. Pylon holds no opinion about which key signs a
// cookie — this is what an app's `keys.cookie.signature` says.
const COOKIE_KEY: PylonSignKey = {
  predicate: { purpose: "cookie", publish: false },
};

describe("signCookie", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = { amphora: createMockAmphora() };
    ctx.amphora.find.mockResolvedValue({
      id: "kid-1",
      use: "sig",
      hasPrivateKey: true,
      isActive: true,
      toJSON: () => ({ id: "kid-1" }),
    });
  });

  test("should return signed value and kid", async () => {
    await expect(signCookie(ctx, "value", COOKIE_KEY)).resolves.toStrictEqual({
      signature: "formatted_signed_value",
      kid: "kid-1",
    });
  });

  test("should query the vault with the floor merged under the deployment's predicate", async () => {
    await signCookie(ctx, "value", COOKIE_KEY);

    expect(ctx.amphora.find).toHaveBeenCalledWith({
      use: "sig",
      hasPrivateKey: true,
      isActive: true,
      purpose: "cookie",
      publish: false,
    });
  });

  // The magic is GONE, not moved. Pylon no longer guesses a purpose, so with no
  // selector there is nothing to select with — and the floor alone would query
  // amphora's default set (the PUBLISHED keys) and hand back the JWKS token key.
  test("should throw when no cookie signing key is configured", async () => {
    await expect(signCookie(ctx, "value", undefined)).rejects.toThrow(
      /Cookie signing key is not configured/,
    );

    expect(ctx.amphora.find).not.toHaveBeenCalled();
  });

  // The mocked-amphora tests above prove the SHAPE. These prove the SELECTION —
  // against a real vault, with a real predicate, because the predicate is the
  // whole point: a mocked `find` cannot select the wrong key.
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

    test("selects the key the options name, NOT the newer published token key", async () => {
      const cookieKey = internalCookieKey();
      const tokenKey = publishedTokenKey();

      amphora.add([cookieKey, tokenKey]);

      const { kid } = await signCookie({ amphora }, "value", COOKIE_KEY);

      expect(kid).toBe(cookieKey.id);
      expect(kid).not.toBe(tokenKey.id);
    });

    test("selects the session key when the options name that one instead", async () => {
      const sessionKey = KryptosKit.generate.auto({
        algorithm: "EdDSA",
        createdAt: older,
        curve: "Ed448",
        issuer: "http://test.lindorm.io",
        publish: false,
        purpose: "session",
      });

      amphora.add([sessionKey, internalCookieKey(), publishedTokenKey()]);

      const { kid } = await signCookie({ amphora }, "value", {
        predicate: { purpose: "session", publish: false },
      });

      expect(kid).toBe(sessionKey.id);
    });

    test("the selected key satisfies the floor and the deployment's predicate", async () => {
      amphora.add([internalCookieKey(), publishedTokenKey()]);

      const { kid } = await signCookie({ amphora }, "value", COOKIE_KEY);
      const selected = amphora.findByIdSync(kid);

      expect(selected.publish).toBe(false);
      expect(selected.purpose).toBe("cookie");
      expect(selected.use).toBe("sig");
      expect(selected.hasPrivateKey).toBe(true);
    });

    // Fail closed: an option naming a key the vault does not hold is loud, not
    // silent. Falling back to "whatever sig key is newest" is how the token key
    // got used in the first place.
    test("throws when the named key is not in the vault", async () => {
      amphora.add([publishedTokenKey()]);

      await expect(signCookie({ amphora }, "value", COOKIE_KEY)).rejects.toThrow(
        /No cookie signing key matches the configured predicate/,
      );
    });

    // An injected key skips the vault, never the floor.
    test("honours an injected kryptos", async () => {
      const injected = internalCookieKey();

      amphora.add([publishedTokenKey()]);

      const { kid } = await signCookie({ amphora }, "value", { kryptos: injected });

      expect(kid).toBe(injected.id);
    });

    test("throws when an injected kryptos violates the signing floor", async () => {
      const encKey = KryptosKit.generate.auto({
        algorithm: "dir",
        issuer: "http://test.lindorm.io",
        publish: false,
        purpose: "cookie",
      });

      await expect(signCookie({ amphora }, "value", { kryptos: encKey })).rejects.toThrow(
        /violates the signing floor/,
      );
    });
  });
});
