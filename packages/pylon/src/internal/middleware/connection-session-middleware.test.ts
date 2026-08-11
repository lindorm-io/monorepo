import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  createMockProteusSource,
  createMockRepository,
} from "@lindorm/proteus/mocks/vitest";
import type { Next } from "@lindorm/middleware";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import type { IPylonSession, PylonSessionHandle } from "../../interfaces/index.js";
import type { PylonSessionSettings } from "../../types/index.js";
import { createSessionSecret } from "../utils/session/create-session-secret.js";
import { sessionRecordKit } from "../utils/session/session-record-key.js";
import { createConnectionSessionMiddleware } from "./connection-session-middleware.js";

const SESSION_ID = "cad4002a-bd04-52f1-9733-58866f421686";

/**
 * The handle the browser carries. It is the WHOLE cookie now — the row's name and
 * the secret that opens it — and the handshake is the one place a socket ever sees
 * it, so everything after the handshake works off the captured copy.
 */
const HANDLE: PylonSessionHandle = { id: SESSION_ID, sec: createSessionSecret() };

const buildSession = (overrides: Partial<IPylonSession> = {}): IPylonSession => ({
  id: SESSION_ID,
  accessToken: "access_token",
  expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  issuedAt: new Date("2024-01-01T00:00:00.000Z"),
  scope: [],
  subject: "sub-1",
  ...overrides,
});

/** The stored ENVELOPE, sealed the way the store seals it. */
const buildRow = (session: IPylonSession, sec = HANDLE.sec) => ({
  id: session.id,
  payloadEncrypted: sessionRecordKit(sec).encrypt({
    id: session.id,
    accessToken: session.accessToken,
    scope: session.scope,
  }),
  subject: session.subject,
  issuedAt: session.issuedAt,
  expiresAt: session.expiresAt,
});

/** The cookie as it arrives on the handshake — unsealed here, base64url encoded. */
const cookieFor = (handle: PylonSessionHandle): string =>
  `pylon_session=${Buffer.from(JSON.stringify(handle)).toString("base64url")}`;

const buildCtx = (cookieHeader: string | undefined, kv?: any): any => {
  const socket: any = {
    handshake: {
      headers: cookieHeader === undefined ? {} : { cookie: cookieHeader },
    },
    data: {
      app: { environment: "test", name: "pylon", version: "0.0.0" },
      pylon: {},
      tokens: {},
    },
  };

  return {
    handshakeId: "handshake-1",
    io: { app: {}, socket },
    logger: createMockLogger(),
    kv,
    amphora: {
      canEncrypt: vi.fn().mockReturnValue(false),
      canDecrypt: vi.fn().mockReturnValue(false),
    },
    aegis: {
      aes: { encrypt: vi.fn(), decrypt: vi.fn() },
      verify: vi.fn((token: string) =>
        Promise.resolve({
          token,
          format: "jwt" as const,
          claims: {
            subject: "sub-1",
            expiresAt: new Date("2099-01-01T00:00:00.000Z"),
          },
        }),
      ),
    },
  };
};

describe("createConnectionSessionMiddleware", () => {
  let next: Next;
  let options: PylonSessionSettings;
  let mockRepo: Awaited<ReturnType<typeof createMockRepository>>;
  let mockProteus: Awaited<ReturnType<typeof createMockProteusSource>>;

  beforeEach(async () => {
    mockRepo = await createMockRepository();
    mockProteus = await createMockProteusSource();
    // The store opens its own request-scoped session off the SOURCE — the
    // handshake chain never runs the dependencies middleware, so there is no
    // `ctx.kv` to read.
    mockProteus.session.mockReturnValue({
      repository: vi.fn().mockReturnValue(mockRepo),
    } as any);

    (mockRepo.findOne as Mock).mockResolvedValue(buildRow(buildSession()));

    options = {
      enabled: true,
      sameSite: "lax",
    };

    next = vi.fn().mockResolvedValue(undefined);
  });

  test("should proceed without session when cookie header is missing", async () => {
    const ctx = buildCtx(undefined, mockProteus);

    await createConnectionSessionMiddleware(mockProteus, options)(ctx, next);

    expect(ctx.io.socket.data.session).toBeUndefined();
    expect(ctx.io.socket.data.pylon.auth).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  test("should proceed without session when cookie header lacks session cookie", async () => {
    const ctx = buildCtx("other=1; another=2", mockProteus);

    await createConnectionSessionMiddleware(mockProteus, options)(ctx, next);

    expect(ctx.io.socket.data.session).toBeUndefined();
    expect(ctx.io.socket.data.pylon.auth).toBeUndefined();
  });

  /**
   * A cookie written under the pre-handle scheme carried a bare id STRING. It is
   * not an error to report — the shape check simply refuses it and the handshake
   * proceeds unauthenticated.
   */
  test("should proceed without session when the cookie is not a handle", async () => {
    const ctx = buildCtx(
      `pylon_session=${Buffer.from(SESSION_ID).toString("base64url")}`,
      mockProteus,
    );

    await createConnectionSessionMiddleware(mockProteus, options)(ctx, next);

    expect(ctx.io.socket.data.session).toBeUndefined();
    expect(mockRepo.findOne).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test("should load session, register auth, and parse bearer when cookie valid", async () => {
    const ctx = buildCtx(cookieFor(HANDLE), mockProteus);

    await createConnectionSessionMiddleware(mockProteus, options)(ctx, next);

    expect(ctx.io.socket.data.session).toMatchSnapshot({
      expiresAt: expect.any(Date),
      issuedAt: expect.any(Date),
    });
    expect(ctx.io.socket.data.pylon.auth.strategy).toBe("session");
    expect(typeof ctx.io.socket.data.pylon.auth.refresh).toBe("function");
    expect(ctx.io.socket.data.tokens.bearer).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  // THE DECRYPT IS THE AUTHENTICATION on the handshake path too: the row is found,
  // and the presented secret is the only thing that decides whether it opens.
  test("should proceed without session when the handle's secret does not open the row", async () => {
    const ctx = buildCtx(
      cookieFor({ id: SESSION_ID, sec: createSessionSecret() }),
      mockProteus,
    );

    await createConnectionSessionMiddleware(mockProteus, options)(ctx, next);

    expect(mockRepo.findOne).toHaveBeenCalled();
    expect(ctx.io.socket.data.session).toBeUndefined();
    expect(ctx.io.socket.data.pylon.auth).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  test("should proceed without session when store returns null", async () => {
    (mockRepo.findOne as Mock).mockResolvedValue(null);

    const ctx = buildCtx(cookieFor(HANDLE), mockProteus);

    await createConnectionSessionMiddleware(mockProteus, options)(ctx, next);

    expect(ctx.io.socket.data.session).toBeUndefined();
    expect(ctx.io.socket.data.pylon.auth).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  test("should proceed without session when session has expired", async () => {
    (mockRepo.findOne as Mock).mockResolvedValue(
      buildRow(buildSession({ expiresAt: new Date("2000-01-01T00:00:00.000Z") })),
    );

    const ctx = buildCtx(cookieFor(HANDLE), mockProteus);

    await createConnectionSessionMiddleware(mockProteus, options)(ctx, next);

    expect(ctx.io.socket.data.session).toBeUndefined();
    expect(ctx.io.socket.data.pylon.auth).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  test("should not overwrite existing socket.data.pylon.auth", async () => {
    const ctx = buildCtx(cookieFor(HANDLE), mockProteus);
    const existing = {
      strategy: "bearer" as const,
      getExpiresAt: () => new Date("2099-01-01T00:00:00.000Z"),
      refresh: vi.fn(),
      authExpiredEmittedAt: null,
    };
    ctx.io.socket.data.pylon.auth = existing;

    await createConnectionSessionMiddleware(mockProteus, options)(ctx, next);

    // Session is still loaded (informational), but auth is preserved.
    expect(ctx.io.socket.data.session).toBeDefined();
    expect(ctx.io.socket.data.pylon.auth).toBe(existing);
    expect(next).toHaveBeenCalled();
  });

  // No `kv` source ⇒ no store, so the handshake has nowhere to resolve the handle
  // the cookie carries. It proceeds unauthenticated rather than guessing.
  test("should proceed without session when no kv source is configured", async () => {
    const ctx = buildCtx(cookieFor(HANDLE), mockProteus);

    await createConnectionSessionMiddleware(undefined, options)(ctx, next);

    expect(ctx.io.socket.data.session).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  /**
   * ⚠ The refresh runs long after the handshake, with no cookie in hand — so it
   * can only re-open the row with a secret it CAPTURED. That is why the lookup
   * takes no argument: the whole handle rides in the closure.
   */
  test("should use store-backed refresh closure that re-reads store", async () => {
    const ctx = buildCtx(cookieFor(HANDLE), mockProteus);

    await createConnectionSessionMiddleware(mockProteus, options)(ctx, next);

    // Now flip the mock to return a new session with a later expiry.
    (mockRepo.findOne as Mock).mockResolvedValue(
      buildRow(
        buildSession({
          accessToken: "new_access_token",
          expiresAt: new Date("2099-06-01T00:00:00.000Z"),
        }),
      ),
    );

    await ctx.io.socket.data.pylon.auth.refresh({});

    expect(ctx.io.socket.data.session.accessToken).toBe("new_access_token");
    expect(ctx.io.socket.data.tokens.bearer).toBeDefined();
  });

  /**
   * ⚠ The captured handle is NOT written to `socket.data`. Putting it there would
   * expose a live decryption key to every listener and to any log line that dumps
   * `socket.data` — and the opened session already sits there in plaintext, so the
   * secret would buy nothing and cost the one place it is contained.
   */
  test("should keep the handle secret out of socket.data", async () => {
    const ctx = buildCtx(cookieFor(HANDLE), mockProteus);

    await createConnectionSessionMiddleware(mockProteus, options)(ctx, next);

    expect(JSON.stringify(ctx.io.socket.data)).not.toContain(HANDLE.sec);
  });

  test("should reject refresh when store returns null", async () => {
    const ctx = buildCtx(cookieFor(HANDLE), mockProteus);

    await createConnectionSessionMiddleware(mockProteus, options)(ctx, next);

    (mockRepo.findOne as Mock).mockResolvedValue(null);

    await expect(ctx.io.socket.data.pylon.auth.refresh({})).rejects.toThrow();
  });

  test("should reject refresh when reloaded session is past expiry", async () => {
    const ctx = buildCtx(cookieFor(HANDLE), mockProteus);

    await createConnectionSessionMiddleware(mockProteus, options)(ctx, next);

    (mockRepo.findOne as Mock).mockResolvedValue(
      buildRow(buildSession({ expiresAt: new Date("2000-01-01T00:00:00.000Z") })),
    );

    await expect(ctx.io.socket.data.pylon.auth.refresh({})).rejects.toThrow();
  });
});
