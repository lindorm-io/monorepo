import { Amphora, type IAmphora } from "@lindorm/amphora";
import { ClientError, ServerError } from "@lindorm/errors";
import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { PylonSignKey } from "../../../types/index.js";
import { signCookie } from "../cookies/sign-cookie.js";
import { verifyCookie } from "../cookies/verify-cookie.js";

/**
 * The TIME half of pylon's cookie floor, end to end: a REAL vault, a REAL
 * `SignatureKit`, and the real sign / verify path a request takes.
 *
 * Amphora already drops inactive keys from a QUERY, so the clock only bites
 * where the vault does not — and both of those places are here:
 *
 *   1. an INJECTED `kryptos` (`keys.cookie.signature: { kryptos }`), which never
 *      touches the vault at all; and
 *   2. `findByIdSync` on the read side, which is unfiltered BY DESIGN because the
 *      cookie's `.kid` — the CLIENT's claim — chooses which key answers for it.
 *
 * The asymmetry is the point: signing demands `isActive`, verification demands
 * only `isPending: false`, so a rotation never logs out a live session.
 */
describe("the cookie time floor", () => {
  const COOKIE_KEY: PylonSignKey = { condition: { purpose: "cookie", publish: false } };

  const cookieKey = (notBefore?: Date, expiresAt?: Date): IKryptos =>
    KryptosKit.generate.auto({
      algorithm: "HS256",
      expiresAt,
      issuer: "http://test.lindorm.io",
      notBefore,
      publish: false,
      purpose: "cookie",
    });

  const vault = (...keys: Array<IKryptos>): IAmphora => {
    const amphora = new Amphora({
      domain: "http://test.lindorm.io",
      logger: createMockLogger(),
    });
    amphora.add(keys);
    return amphora;
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("write", () => {
    test("refuses to SIGN with an injected key that has expired", async () => {
      const expired = cookieKey(new Date("2020-01-01"), new Date("2021-01-01"));

      await expect(
        signCookie({ amphora: vault() }, "value", { kryptos: expired }),
      ).rejects.toThrow(/violates the signing floor/);
    });

    test("refuses to SIGN with an injected key that is not yet valid", async () => {
      const pending = cookieKey(new Date("2099-01-01"), new Date("2100-01-01"));

      await expect(
        signCookie({ amphora: vault() }, "value", { kryptos: pending }),
      ).rejects.toThrow(/violates the signing floor/);
    });

    // `Amphora.add` refuses a key that is ALREADY expired, so the only way a vault
    // holds one is the way a deployment gets one: it was added while valid, and it
    // aged. The clock has to move for this to be honest.
    test("refuses to SIGN with a vault key that has expired since it was added", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-06-01T00:00:00.000Z"));

      const amphora = vault(
        cookieKey(
          new Date("2024-01-01T00:00:00.000Z"),
          new Date("2025-01-01T00:00:00.000Z"),
        ),
      );

      await expect(signCookie({ amphora }, "value", COOKIE_KEY)).resolves.toMatchObject({
        kid: expect.any(String),
      });

      vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));

      await expect(signCookie({ amphora }, "value", COOKIE_KEY)).rejects.toThrow(
        ServerError,
      );
    });
  });

  describe("read", () => {
    // THE ROTATION PROPERTY. A cookie is signed once and read for as long as it
    // lives. If the verification floor demanded `isActive`, minting next year's
    // cookie key would invalidate every cookie the current one signed — i.e. log
    // out every live session. This is the test that must never regress.
    test("still VERIFIES a cookie signed by a key that has since expired", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-06-01T00:00:00.000Z"));

      const key = cookieKey(
        new Date("2024-01-01T00:00:00.000Z"),
        new Date("2025-01-01T00:00:00.000Z"),
      );
      const amphora = vault(key);

      const { signature, kid } = await signCookie({ amphora }, "value", COOKIE_KEY);

      // Two years on: the key has expired, the cookie has not.
      vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));
      expect(key.isExpired).toBe(true);

      await expect(
        verifyCookie({ amphora }, "name", "value", signature, kid, undefined),
      ).resolves.toBeUndefined();
    });

    // The other direction: a key whose `notBefore` has not passed cannot have
    // signed anything, ever — so a `.kid` naming it is a claim about a signature
    // that cannot exist. `Amphora.add` accepts a pending key, which is exactly why
    // the floor has to refuse it.
    test("refuses to VERIFY against a key that is not yet valid", async () => {
      const pending = cookieKey(new Date("2099-01-01"), new Date("2100-01-01"));
      const amphora = vault(pending);

      // A signature the pending key could not have produced, presented with its
      // kid. The floor rejects the KEY before any signature is touched.
      await expect(
        verifyCookie({ amphora }, "name", "value", "signature", pending.id, undefined),
      ).rejects.toThrow(ClientError);
    });
  });
});
