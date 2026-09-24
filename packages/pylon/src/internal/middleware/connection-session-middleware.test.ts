import { Aegis } from "@lindorm/aegis";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  createMockProteusSource,
  createMockRepository,
} from "@lindorm/proteus/mocks/vitest";
import type { Next } from "@lindorm/middleware";
import { beforeAll, beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import {
  createTestAppConfig,
  createTestAuthConfig,
} from "../../__fixtures__/app-config.js";
import type { IPylonSession, PylonSessionHandle } from "../../interfaces/index.js";
import type { PylonEncKey, PylonSessionSettings } from "../../types/index.js";
import { encryptCookie } from "../utils/cookies/encrypt-cookie.js";
import { createSessionSecret } from "../utils/session/create-session-secret.js";
import { sessionRecordKit } from "../utils/session/session-record-key.js";
import { createConnectionSessionMiddleware } from "./connection-session-middleware.js";

const ISSUER = "http://test.lindorm.io";

const SESSION_ID = "cad4002a-bd04-52f1-9733-58866f421686";

/**
 * The session's encryption key is REQUIRED and does not inherit, so there is no
 * mode in which the handshake cookie arrives in the clear — the middleware reads
 * it `encrypted: true` always, and an unsealed value is refused outright.
 *
 * The fixture therefore seals through the SAME `encryptCookie` the cookie
 * middleware writes with, against a real vault holding the key this selector
 * names: the planted cookie is the artifact pylon itself would have written, not
 * a hand-rolled approximation of it.
 */
const SESSION_ENCRYPTION: PylonEncKey = {
  condition: { purpose: "session", publish: false },
};

let amphora: IAmphora;
let aegis: Aegis;

const seal = (value: unknown): Promise<string> =>
  encryptCookie({ aegis, amphora }, value as any, SESSION_ENCRYPTION);

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

/** The cookie as it arrives on the handshake — sealed, exactly as pylon wrote it. */
const cookieFor = async (handle: PylonSessionHandle): Promise<string> =>
  `pylon_session=${await seal(handle)}`;

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
    amphora,
    state: { app: { config: createTestAppConfig({ auth: createTestAuthConfig() }) } },
    aegis: {
      // REAL aes — the cookie is sealed, so the read path's decrypt is part of
      // what the handshake is being tested on. `verify` stays mocked: the
      // session's access token here is an opaque fixture string, not a JWT.
      aes: aegis.aes,
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

  beforeAll(() => {
    const logger = createMockLogger();

    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });

    amphora.add(
      KryptosKit.generate.auto({
        algorithm: "dir",
        issuer: ISSUER,
        publish: false,
        purpose: "session",
      }),
    );

    aegis = new Aegis({ amphora, logger });
  });

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

    // The SAME selector the fixture seals with — the middleware and the cookie it
    // is handed cannot drift onto different keys.
    options = {
      enabled: true,
      encryption: SESSION_ENCRYPTION,
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
   * A cookie written under the pre-handle scheme carried a bare id STRING. Sealed
   * with this deployment's own session key — so it passes every policy check the
   * read applies and reaches the shape check with a legitimately opened value. It
   * is not an error to report: the shape check simply refuses it and the
   * handshake proceeds unauthenticated.
   */
  test("should proceed without session when the cookie is not a handle", async () => {
    const ctx = buildCtx(`pylon_session=${await seal(SESSION_ID)}`, mockProteus);

    await createConnectionSessionMiddleware(mockProteus, options)(ctx, next);

    expect(ctx.io.socket.data.session).toBeUndefined();
    expect(mockRepo.findOne).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test("forwards the deployment critical declaration to aegis", async () => {
    const ctx = buildCtx(await cookieFor(HANDLE), mockProteus);
    ctx.state = {
      app: {
        config: createTestAppConfig({
          auth: createTestAuthConfig({ critical: ["objectId"] }),
        }),
      },
    };

    await createConnectionSessionMiddleware(mockProteus, options)(ctx, next);

    expect(ctx.aegis.verify).toHaveBeenCalledWith("access_token", undefined, {
      critical: ["objectId"],
    });
  });

  // The refresh handler is its own threading member (`critical` handed to
  // `createSessionRefreshHandler`), so the install-time forward above does not
  // cover its verify call.
  test("the refresh handler re-verifies under the deployment critical declaration", async () => {
    const ctx = buildCtx(await cookieFor(HANDLE), mockProteus);
    ctx.state = {
      app: {
        config: createTestAppConfig({
          auth: createTestAuthConfig({ critical: ["objectId"] }),
        }),
      },
    };

    await createConnectionSessionMiddleware(mockProteus, options)(ctx, next);
    (ctx.aegis.verify as Mock).mockClear();

    await ctx.io.socket.data.pylon.auth.refresh({});

    expect(ctx.aegis.verify).toHaveBeenCalledWith("access_token", undefined, {
      critical: ["objectId"],
    });
  });

  test("should load session, register auth, and parse bearer when cookie valid", async () => {
    const ctx = buildCtx(await cookieFor(HANDLE), mockProteus);

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
      await cookieFor({ id: SESSION_ID, sec: createSessionSecret() }),
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

    const ctx = buildCtx(await cookieFor(HANDLE), mockProteus);

    await createConnectionSessionMiddleware(mockProteus, options)(ctx, next);

    expect(ctx.io.socket.data.session).toBeUndefined();
    expect(ctx.io.socket.data.pylon.auth).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  test("should proceed without session when session has expired", async () => {
    (mockRepo.findOne as Mock).mockResolvedValue(
      buildRow(buildSession({ expiresAt: new Date("2000-01-01T00:00:00.000Z") })),
    );

    const ctx = buildCtx(await cookieFor(HANDLE), mockProteus);

    await createConnectionSessionMiddleware(mockProteus, options)(ctx, next);

    expect(ctx.io.socket.data.session).toBeUndefined();
    expect(ctx.io.socket.data.pylon.auth).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  test("should not overwrite existing socket.data.pylon.auth", async () => {
    const ctx = buildCtx(await cookieFor(HANDLE), mockProteus);
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
    const ctx = buildCtx(await cookieFor(HANDLE), mockProteus);

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
    const ctx = buildCtx(await cookieFor(HANDLE), mockProteus);

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
    const ctx = buildCtx(await cookieFor(HANDLE), mockProteus);

    await createConnectionSessionMiddleware(mockProteus, options)(ctx, next);

    expect(JSON.stringify(ctx.io.socket.data)).not.toContain(HANDLE.sec);
  });

  test("should reject refresh when store returns null", async () => {
    const ctx = buildCtx(await cookieFor(HANDLE), mockProteus);

    await createConnectionSessionMiddleware(mockProteus, options)(ctx, next);

    (mockRepo.findOne as Mock).mockResolvedValue(null);

    await expect(ctx.io.socket.data.pylon.auth.refresh({})).rejects.toThrow();
  });

  test("should reject refresh when reloaded session is past expiry", async () => {
    const ctx = buildCtx(await cookieFor(HANDLE), mockProteus);

    await createConnectionSessionMiddleware(mockProteus, options)(ctx, next);

    (mockRepo.findOne as Mock).mockResolvedValue(
      buildRow(buildSession({ expiresAt: new Date("2000-01-01T00:00:00.000Z") })),
    );

    await expect(ctx.io.socket.data.pylon.auth.refresh({})).rejects.toThrow();
  });
});
