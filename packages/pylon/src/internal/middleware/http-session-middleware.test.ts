import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  createMockProteusSource,
  createMockRepository,
} from "@lindorm/proteus/mocks/vitest";
import type { Next } from "@lindorm/middleware";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../__fixtures__/app-config.js";
import type { IPylonSession, PylonSessionHandle } from "../../interfaces/index.js";
import type { PylonSessionSettings } from "../../types/index.js";
import { createHttpSessionMiddleware } from "./http-session-middleware.js";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

const SESSION_ID = "cad4002a-bd04-52f1-9733-58866f421686";

const buildSession = (overrides: Partial<IPylonSession> = {}): IPylonSession => ({
  id: SESSION_ID,
  accessToken: "access_token",
  expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  idToken: "id_token",
  issuedAt: MockedDate,
  refreshToken: "refresh_token",
  scope: ["openid"],
  subject: "sub-1",
  ...overrides,
});

describe("httpSessionMiddleware", () => {
  let ctx: any;
  let mockRepo: Awaited<ReturnType<typeof createMockRepository>>;
  let mockProteus: Awaited<ReturnType<typeof createMockProteusSource>>;
  let next: Next;
  let options: PylonSessionSettings;
  let stored: Record<string, any>;

  beforeEach(async () => {
    mockRepo = await createMockRepository();
    mockProteus = await createMockProteusSource();
    // The store opens its own request-scoped session off the SOURCE: this
    // middleware runs BEFORE the dependencies middleware that installs `ctx.kv`.
    mockProteus.session.mockReturnValue({
      repository: vi.fn().mockReturnValue(mockRepo),
    } as any);

    stored = {};

    (mockRepo.upsert as Mock).mockImplementation(async (entity: any) => {
      stored[entity.id] = entity;
      return entity;
    });
    (mockRepo.findOne as Mock).mockImplementation(async ({ id }: { id: string }) =>
      stored[id] ? structuredClone(stored[id]) : null,
    );
    (mockRepo.delete as Mock).mockResolvedValue(undefined);

    ctx = {
      logger: createMockLogger(),
      cookies: {
        set: vi.fn(),
        get: vi.fn().mockResolvedValue(null),
        del: vi.fn(),
      },
      amphora: {
        canEncrypt: vi.fn().mockReturnValue(false),
        canDecrypt: vi.fn().mockReturnValue(false),
      },
      aegis: {
        aes: { encrypt: vi.fn(), decrypt: vi.fn() },
        verify: vi.fn().mockResolvedValue({ claims: {}, format: "jwt" }),
      },
      state: {
        app: { config: createTestAppConfig({ auth: createTestAuthConfig() }) },
        metadata: {},
        session: null,
        tokens: {},
      },
    };

    options = {
      enabled: true,
      encryption: { condition: { purpose: "session", publish: false } },
      sameSite: "strict",
    };

    next = () => Promise.resolve();
  });

  /** The handle the middleware last wrote into the cookie. */
  const writtenHandle = (): PylonSessionHandle =>
    (ctx.cookies.set as Mock).mock.calls.at(-1)![1];

  describe("establish", () => {
    // No incoming cookie ⇒ mint. The id is the SESSION's — it may be the IdP's
    // own `sessionId` claim, and `metadata.sessionId` correlation depends on it —
    // and the secret is fresh.
    test("mints a handle and writes it into the cookie", async () => {
      await createHttpSessionMiddleware(mockProteus, options)(ctx, next);

      const session = buildSession();
      await ctx.session.set(session);

      const handle = writtenHandle();

      expect(handle.id).toBe(SESSION_ID);
      expect(handle.sec).toHaveLength(86);
      expect(ctx.cookies.set).toHaveBeenCalledWith(
        "pylon_session",
        handle,
        expect.objectContaining({ expiry: session.expiresAt }),
      );
    });

    // The cookie carries the ONLY copy of the secret. Nothing derived from it may
    // reach the row, or the dump stops being inert.
    test("keeps the secret out of the stored row", async () => {
      await createHttpSessionMiddleware(mockProteus, options)(ctx, next);

      await ctx.session.set(buildSession());

      expect(JSON.stringify(stored[SESSION_ID])).not.toContain(writtenHandle().sec);
    });
  });

  describe("read", () => {
    test("opens the row with the handle the cookie carried", async () => {
      await createHttpSessionMiddleware(mockProteus, options)(ctx, next);

      const session = buildSession();
      await ctx.session.set(session);

      // A second request, carrying the cookie the first one wrote.
      const handle = writtenHandle();
      ctx.cookies.get.mockResolvedValue(handle);
      ctx.state.session = null;

      await createHttpSessionMiddleware(mockProteus, options)(ctx, next);

      expect(ctx.state.session).toEqual(session);
      expect(ctx.state.metadata.sessionId).toBe(SESSION_ID);
    });

    /**
     * ONE outcome for every "a session cookie did not resolve": stale shape,
     * dead row, or a secret that does not open it. The cookie is cleared, the fact
     * is logged, and the request proceeds unauthenticated — the ROW is left alone.
     */
    test("clears the cookie and warns when the row is gone", async () => {
      ctx.cookies.get.mockResolvedValue({ id: SESSION_ID, sec: "a".repeat(86) });

      await createHttpSessionMiddleware(mockProteus, options)(ctx, next);

      expect(ctx.state.session).toBeNull();
      expect(ctx.cookies.del).toHaveBeenCalledWith("pylon_session");
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        "Session cookie did not resolve to a live session; clearing it",
        { sessionId: SESSION_ID },
      );
      // The row is never deleted on a failed read.
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    test("clears the cookie and warns when the secret does not open the row", async () => {
      await createHttpSessionMiddleware(mockProteus, options)(ctx, next);
      await ctx.session.set(buildSession());

      ctx.cookies.get.mockResolvedValue({ id: SESSION_ID, sec: "b".repeat(86) });
      ctx.state.session = null;

      await createHttpSessionMiddleware(mockProteus, options)(ctx, next);

      expect(ctx.state.session).toBeNull();
      expect(ctx.cookies.del).toHaveBeenCalledWith("pylon_session");
      expect(stored[SESSION_ID]).toBeDefined();
    });

    // A cookie written under the pre-handle scheme is a bare id STRING. It never
    // reaches the store: the shape check refuses it and the cookie is cleared.
    test("clears the cookie without a store read when the shape is not a handle", async () => {
      ctx.cookies.get.mockResolvedValue(SESSION_ID);

      await createHttpSessionMiddleware(mockProteus, options)(ctx, next);

      expect(ctx.state.session).toBeNull();
      expect(mockRepo.findOne).not.toHaveBeenCalled();
      expect(ctx.cookies.del).toHaveBeenCalledWith("pylon_session");
      expect(ctx.logger.warn).toHaveBeenCalledWith(expect.any(String), {
        sessionId: null,
      });
    });

    // A request that sent no cookie must not be answered with a `Set-Cookie`
    // deleting one it never had.
    test("stays silent when no cookie arrived", async () => {
      await createHttpSessionMiddleware(mockProteus, options)(ctx, next);

      expect(ctx.state.session).toBeNull();
      expect(ctx.cookies.del).not.toHaveBeenCalled();
      expect(ctx.logger.warn).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    /**
     * ⚠ The secret does NOT rotate. An update MUST re-seal under the secret the
     * browser already holds — minting a fresh one on a refresh would re-seal the
     * row under a key the deployment's other tabs do not have, and every
     * concurrent refresh would become a hard logout race with no grace window.
     */
    test("reuses the incoming handle when the id is unchanged", async () => {
      await createHttpSessionMiddleware(mockProteus, options)(ctx, next);
      await ctx.session.set(buildSession());

      const first = writtenHandle();

      ctx.cookies.get.mockResolvedValue(first);
      ctx.state.session = null;

      await createHttpSessionMiddleware(mockProteus, options)(ctx, next);
      await ctx.session.set(buildSession({ accessToken: "refreshed_access_token" }));

      const second = writtenHandle();

      expect(second.id).toBe(first.id);
      expect(second.sec).toBe(first.sec);

      // And the row re-opens with that same, unrotated handle.
      ctx.cookies.get.mockResolvedValue(second);
      ctx.state.session = null;

      await createHttpSessionMiddleware(mockProteus, options)(ctx, next);

      expect(ctx.state.session.accessToken).toBe("refreshed_access_token");
    });

    // A fresh login carries a NEW id, so the secret is minted with it. That is the
    // only thing that rotates it.
    test("mints a new secret when the id changes", async () => {
      await createHttpSessionMiddleware(mockProteus, options)(ctx, next);
      await ctx.session.set(buildSession());

      const first = writtenHandle();

      ctx.cookies.get.mockResolvedValue(first);
      ctx.state.session = null;

      await createHttpSessionMiddleware(mockProteus, options)(ctx, next);
      await ctx.session.set(buildSession({ id: "another-session-id" }));

      const second = writtenHandle();

      expect(second.id).toBe("another-session-id");
      expect(second.sec).not.toBe(first.sec);
    });
  });

  // No kv source ⇒ no store ⇒ cookie-only: the whole session object is the
  // cookie's value, written and read straight through. The handle shape never
  // reaches this path.
  test("should read the session out of the cookie when no kv source is configured", async () => {
    const cookieOnly = buildSession({ expiresAt: null });

    ctx.cookies.get.mockResolvedValue(cookieOnly);

    await createHttpSessionMiddleware(undefined, options)(ctx, next);

    expect(ctx.state.session).toEqual(cookieOnly);
    expect(ctx.cookies.del).not.toHaveBeenCalled();

    await ctx.session.set(cookieOnly);

    expect(ctx.cookies.set).toHaveBeenCalledWith(
      "pylon_session",
      cookieOnly,
      expect.anything(),
    );
  });

  describe("destroy", () => {
    test("deletes the row the incoming cookie named", async () => {
      await createHttpSessionMiddleware(mockProteus, options)(ctx, next);
      await ctx.session.set(buildSession());

      ctx.cookies.get.mockResolvedValue(writtenHandle());
      ctx.state.session = null;

      await createHttpSessionMiddleware(mockProteus, options)(ctx, next);

      await expect(ctx.session.del()).resolves.toBeUndefined();

      expect(mockRepo.delete).toHaveBeenCalledWith({ id: SESSION_ID });
      expect(ctx.cookies.del).toHaveBeenCalledWith("pylon_session");
    });

    // Back-channel logout arrives with NO cookie at all: it deletes by the
    // CLEARTEXT subject column, which is the one write that can never require a
    // holder.
    test("logs out by subject with no cookie present", async () => {
      await createHttpSessionMiddleware(mockProteus, options)(ctx, next);

      await expect(ctx.session.logout("sub-1")).resolves.toBeUndefined();

      expect(mockRepo.delete).toHaveBeenCalledWith({ subject: "sub-1" });
    });
  });
});
