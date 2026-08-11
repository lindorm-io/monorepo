import { describe, expect, test } from "vitest";
import { PylonError } from "../../../errors/PylonError.js";
import { validateSessionEncryption } from "./validate-session-encryption.js";

const KEY = { condition: { purpose: "session", publish: false } };

describe("validateSessionEncryption", () => {
  test("should pass silently when sessions are off", () => {
    expect(() => validateSessionEncryption({})).not.toThrow();
  });

  // Cookie-only: `createSessionStore` returns nothing without a `kv` source, so
  // `httpSessionMiddleware` puts the WHOLE session — access, id and refresh
  // token — in the cookie. Unsealed, that is a working credential set in the
  // browser's cookie jar, re-sent on every request.
  test("should THROW for a cookie-only session with no key on either tier", () => {
    expect(() =>
      validateSessionEncryption({
        auth: { driver: {} as any, session: { enabled: true } },
      }),
    ).toThrow(PylonError);
  });

  /**
   * ⚠ ONE severity, both modes. This used to WARN and run, because the cookie
   * carried only an opaque id. It now carries `{ id, sec }`, and `sec` is the key
   * that decrypts the stored session — unsealed, that key sits in the browser jar
   * and in every proxy log that dumps `Cookie` headers.
   */
  test("should THROW for a kv-backed session with no key on either tier", () => {
    expect(() =>
      validateSessionEncryption({
        auth: { driver: {} as any, session: { enabled: true } },
        kv: {} as any,
      }),
    ).toThrow(PylonError);
  });

  test("should name the settings to add in the thrown error", () => {
    for (const options of [
      { auth: { driver: {} as any, session: { enabled: true as const } } },
      {
        auth: { driver: {} as any, session: { enabled: true as const } },
        kv: {} as any,
      },
    ]) {
      try {
        validateSessionEncryption(options);
        throw new Error("did not throw");
      } catch (err: any) {
        expect(err).toBeInstanceOf(PylonError);
        expect(err.code).toBe("session_encryption_not_configured");
        expect(err.details).toContain("auth.session.encryption");
        expect(err.details).toContain("cookies.encryption");
      }
    }
  });

  test("should pass for a cookie-only session that names its own key", () => {
    expect(() =>
      validateSessionEncryption({
        auth: { driver: {} as any, session: { enabled: true, encryption: KEY } },
      }),
    ).not.toThrow();
  });

  // The documented convenience of naming ONE key for every cookie survives: an
  // inherited key resolves through `session.encryption ?? cookies.encryption`
  // and is a decision, just not a second declaration.
  test("should pass for a cookie-only session inheriting the cookies key", () => {
    expect(() =>
      validateSessionEncryption({
        auth: { driver: {} as any, session: { enabled: true } },
        cookies: { encryption: KEY },
      }),
    ).not.toThrow();
  });

  test("should pass for a kv-backed session that resolves a key", () => {
    expect(() =>
      validateSessionEncryption({
        auth: { driver: {} as any, session: { enabled: true } },
        cookies: { encryption: KEY },
        kv: {} as any,
      }),
    ).not.toThrow();
  });
});
