import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import { beforeEach, describe, expect, test } from "vitest";
import { PylonError } from "../../../errors/PylonError.js";
import { validateSessionEncryption } from "./validate-session-encryption.js";

const KEY = { condition: { purpose: "session", publish: false } };

describe("validateSessionEncryption", () => {
  let logger: ILogger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  test("should pass silently when sessions are off", () => {
    expect(() => validateSessionEncryption({}, logger)).not.toThrow();

    expect(logger.warn).not.toHaveBeenCalled();
  });

  // Cookie-only: `createSessionStore` returns nothing without a `kv` source, so
  // `httpSessionMiddleware` puts the WHOLE session — access, id and refresh
  // token — in the cookie. Unsealed, that is a working credential set in the
  // browser's cookie jar, re-sent on every request.
  test("should THROW for a cookie-only session with no key on either tier", () => {
    expect(() =>
      validateSessionEncryption(
        { auth: { driver: {} as any, session: { enabled: true } } },
        logger,
      ),
    ).toThrow(PylonError);

    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("should name the settings to add in the thrown error", () => {
    try {
      validateSessionEncryption(
        { auth: { driver: {} as any, session: { enabled: true } } },
        logger,
      );
      throw new Error("did not throw");
    } catch (err: any) {
      expect(err).toBeInstanceOf(PylonError);
      expect(err.code).toBe("session_encryption_not_configured");
      expect(err.details).toContain("auth.session.encryption");
      expect(err.details).toContain("cookies.encryption");
    }
  });

  test("should pass for a cookie-only session that names its own key", () => {
    expect(() =>
      validateSessionEncryption(
        { auth: { driver: {} as any, session: { enabled: true, encryption: KEY } } },
        logger,
      ),
    ).not.toThrow();

    expect(logger.warn).not.toHaveBeenCalled();
  });

  // The documented convenience of naming ONE key for every cookie survives: an
  // inherited key resolves through `session.encryption ?? cookies.encryption`
  // and is a decision, just not a second declaration.
  test("should pass for a cookie-only session inheriting the cookies key", () => {
    expect(() =>
      validateSessionEncryption(
        {
          auth: { driver: {} as any, session: { enabled: true } },
          cookies: { encryption: KEY },
        },
        logger,
      ),
    ).not.toThrow();

    expect(logger.warn).not.toHaveBeenCalled();
  });

  // With a store the cookie carries an opaque id and the tokens sit behind the
  // store's own access boundary — weaker, but a workable deployment.
  test("should WARN once, not throw, for a kv-backed session with no key", () => {
    expect(() =>
      validateSessionEncryption(
        { auth: { driver: {} as any, session: { enabled: true } }, kv: {} as any },
        logger,
      ),
    ).not.toThrow();

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("auth.session.encryption"),
    );
  });

  test("should stay silent for a kv-backed session that resolves a key", () => {
    expect(() =>
      validateSessionEncryption(
        {
          auth: { driver: {} as any, session: { enabled: true } },
          cookies: { encryption: KEY },
          kv: {} as any,
        },
        logger,
      ),
    ).not.toThrow();

    expect(logger.warn).not.toHaveBeenCalled();
  });
});
