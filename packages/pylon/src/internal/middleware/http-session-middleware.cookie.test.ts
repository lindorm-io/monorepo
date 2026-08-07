import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { IPylonSession } from "../../interfaces/index.js";
import type { PylonSessionSettings } from "../../types/index.js";
import { createHttpCookiesMiddleware } from "./http-cookies-middleware.js";
import { createHttpSessionMiddleware } from "./http-session-middleware.js";

/**
 * The session cookie's ATTRIBUTES, off a real `set-cookie` header.
 *
 * Two of them are not the deployment's to choose, so they are asserted here
 * rather than left to configuration:
 *
 * - `httponly` is unconditional. The cookie addresses an access token, an id
 *   token and a refresh token; without it any XSS reads all three.
 * - the expiry IS `session.expiresAt`. A separately configured max-age could
 *   only disagree with the record it addresses — a cookie outliving it points at
 *   nothing, a record outliving the cookie is unreachable — so there is one
 *   value and no way to make two.
 */
const EXPIRES_AT = new Date("2024-06-01T12:00:00.000Z");

const buildSession = (expiresAt: Date | null): IPylonSession => ({
  id: "4f38fec0-70cb-53cb-b82b-42b41e7f986e",
  accessToken: "access-token",
  expiresAt,
  issuedAt: new Date("2024-01-01T00:00:00.000Z"),
  scope: ["openid"],
  subject: "643881f8-f6b0-5a18-9396-6fbe29ebfec8",
});

describe("httpSessionMiddleware — session cookie attributes", () => {
  let ctx: any;
  let options: PylonSessionSettings;

  /** The raw `set-cookie` header for `pylon_session`. */
  const sessionHeader = (): string => {
    const headers = (ctx.set.mock.calls[0]?.[1] ?? []) as Array<string>;
    const header = headers.find((h) => h.startsWith("pylon_session="));

    expect(header).toBeDefined();

    return header!;
  };

  /** Cookies middleware + session middleware, exactly as `PylonHttp` composes them. */
  const run = async (session: IPylonSession): Promise<void> => {
    const cookies = createHttpCookiesMiddleware();
    const middleware = createHttpSessionMiddleware(undefined, options);

    await cookies(ctx, async () => {
      await middleware(ctx, async () => {
        await ctx.session.set(session);
      });
    });
  };

  beforeEach(() => {
    options = { enabled: true, sameSite: "lax", secure: true };

    ctx = {
      aegis: { verify: vi.fn().mockResolvedValue({ format: "opaque" }) },
      amphora: { canDecrypt: vi.fn().mockReturnValue(false) },
      get: vi.fn().mockReturnValue(""),
      set: vi.fn(),
      logger: createMockLogger(),
      state: { metadata: {}, session: null, tokens: {} },
    };
  });

  // `httpOnly` is not a `PylonSessionSettings` field at all, so this asserts the
  // forced value — there is no configuration that can turn it off.
  test("the session cookie is always httpOnly", async () => {
    await run(buildSession(EXPIRES_AT));

    expect(sessionHeader()).toContain("; httponly");
  });

  test("the cookie expiry IS the session's expiresAt", async () => {
    await run(buildSession(EXPIRES_AT));

    expect(sessionHeader()).toContain(`; expires=${EXPIRES_AT.toUTCString()}`);
  });

  // A session with no deadline of its own gets a cookie with no deadline of its
  // own — a browser-session cookie. That is the defined mapping, not a gap.
  test("a null expiresAt produces a cookie with no expiry at all", async () => {
    await run(buildSession(null));

    const header = sessionHeader();

    expect(header).not.toContain("expires=");
    expect(header.toLowerCase()).not.toContain("max-age");
  });

  // Two writes in one process must not share an expiry: the attributes are
  // hoisted once, but the expiry is derived per session.
  test("each write carries its OWN session's expiry", async () => {
    const later = new Date("2025-01-01T00:00:00.000Z");

    await run(buildSession(EXPIRES_AT));
    expect(sessionHeader()).toContain(`; expires=${EXPIRES_AT.toUTCString()}`);

    ctx.set = vi.fn();
    ctx.get = vi.fn().mockReturnValue("");

    await run(buildSession(later));
    expect(sessionHeader()).toContain(`; expires=${later.toUTCString()}`);
  });

  // The declared presentation attributes still reach the header — the hoisted
  // static half is not lost when the per-session expiry is layered on.
  test("the declared presentation attributes still reach the header", async () => {
    await run(buildSession(EXPIRES_AT));

    const header = sessionHeader();

    expect(header).toContain("; samesite=lax");
    expect(header).toContain("; secure");
  });
});
