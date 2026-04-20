import { createMockLogger } from "@lindorm/logger/mocks/jest";
import {
  createMockProteusSource,
  createMockRepository,
} from "@lindorm/proteus/mocks/jest";
import { Next } from "@lindorm/middleware";
import { PylonSessionOptions } from "../../types";
import { createConnectionSessionMiddleware } from "./connection-session-middleware";

const SESSION_ID = "cad4002a-bd04-52f1-9733-58866f421686";

const buildSession = (overrides: Partial<any> = {}) => ({
  id: SESSION_ID,
  accessToken: "access_token",
  expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  issuedAt: new Date("2024-01-01T00:00:00.000Z"),
  scope: [],
  subject: "sub-1",
  ...overrides,
});

const buildCtx = (cookieHeader: string | undefined, proteus?: any): any => {
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
    proteus,
    amphora: {
      canEncrypt: jest.fn().mockReturnValue(false),
      canDecrypt: jest.fn().mockReturnValue(false),
    },
    aegis: {
      aes: { encrypt: jest.fn(), decrypt: jest.fn() },
      verify: jest.fn((token: string) =>
        Promise.resolve({
          token,
          header: { baseFormat: "JWT" as const },
          payload: {
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
  let options: PylonSessionOptions;
  let mockRepo: ReturnType<typeof createMockRepository>;
  let mockProteus: ReturnType<typeof createMockProteusSource>;

  beforeEach(() => {
    mockRepo = createMockRepository();
    mockProteus = createMockProteusSource();
    mockProteus.repository.mockReturnValue(mockRepo);

    (mockRepo.findOne as jest.Mock).mockResolvedValue(buildSession());

    options = {
      enabled: true,
      encrypted: false,
      expiry: "90 minutes",
      httpOnly: true,
      sameSite: "lax",
      signed: false,
      name: "test_pylon_session",
    };

    next = jest.fn().mockResolvedValue(undefined);
  });

  test("should proceed without session when cookie header is missing", async () => {
    const ctx = buildCtx(undefined, mockProteus);

    await createConnectionSessionMiddleware(options)(ctx, next);

    expect(ctx.io.socket.data.session).toBeUndefined();
    expect(ctx.io.socket.data.pylon.auth).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  test("should proceed without session when cookie header lacks session cookie", async () => {
    const ctx = buildCtx("other=1; another=2", mockProteus);

    await createConnectionSessionMiddleware(options)(ctx, next);

    expect(ctx.io.socket.data.session).toBeUndefined();
    expect(ctx.io.socket.data.pylon.auth).toBeUndefined();
  });

  test("should load session, register auth, and parse bearer when cookie valid", async () => {
    const ctx = buildCtx(`test_pylon_session=${SESSION_ID}`, mockProteus);

    await createConnectionSessionMiddleware(options)(ctx, next);

    expect(ctx.io.socket.data.session).toMatchSnapshot({
      expiresAt: expect.any(Date),
      issuedAt: expect.any(Date),
    });
    expect(ctx.io.socket.data.pylon.auth.strategy).toBe("session");
    expect(typeof ctx.io.socket.data.pylon.auth.refresh).toBe("function");
    expect(ctx.io.socket.data.tokens.bearer).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  test("should proceed without session when store returns null", async () => {
    (mockRepo.findOne as jest.Mock).mockResolvedValue(null);

    const ctx = buildCtx(`test_pylon_session=${SESSION_ID}`, mockProteus);

    await createConnectionSessionMiddleware(options)(ctx, next);

    expect(ctx.io.socket.data.session).toBeUndefined();
    expect(ctx.io.socket.data.pylon.auth).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  test("should proceed without session when session has expired", async () => {
    (mockRepo.findOne as jest.Mock).mockResolvedValue(
      buildSession({ expiresAt: new Date("2000-01-01T00:00:00.000Z") }),
    );

    const ctx = buildCtx(`test_pylon_session=${SESSION_ID}`, mockProteus);

    await createConnectionSessionMiddleware(options)(ctx, next);

    expect(ctx.io.socket.data.session).toBeUndefined();
    expect(ctx.io.socket.data.pylon.auth).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  test("should not overwrite existing socket.data.pylon.auth", async () => {
    const ctx = buildCtx(`test_pylon_session=${SESSION_ID}`, mockProteus);
    const existing = {
      strategy: "bearer" as const,
      getExpiresAt: () => new Date("2099-01-01T00:00:00.000Z"),
      refresh: jest.fn(),
      authExpiredEmittedAt: null,
    };
    ctx.io.socket.data.pylon.auth = existing;

    await createConnectionSessionMiddleware(options)(ctx, next);

    // Session is still loaded (informational), but auth is preserved.
    expect(ctx.io.socket.data.session).toBeDefined();
    expect(ctx.io.socket.data.pylon.auth).toBe(existing);
    expect(next).toHaveBeenCalled();
  });

  test("should proceed without session when store is disabled", async () => {
    options.enabled = false;
    const ctx = buildCtx(`test_pylon_session=${SESSION_ID}`, mockProteus);

    await createConnectionSessionMiddleware(options)(ctx, next);

    expect(ctx.io.socket.data.session).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  test("should use store-backed refresh closure that re-reads store", async () => {
    const ctx = buildCtx(`test_pylon_session=${SESSION_ID}`, mockProteus);

    await createConnectionSessionMiddleware(options)(ctx, next);

    // Now flip the mock to return a new session with a later expiry.
    (mockRepo.findOne as jest.Mock).mockResolvedValue(
      buildSession({
        accessToken: "new_access_token",
        expiresAt: new Date("2099-06-01T00:00:00.000Z"),
      }),
    );

    await ctx.io.socket.data.pylon.auth.refresh({});

    expect(ctx.io.socket.data.session.accessToken).toBe("new_access_token");
    expect(ctx.io.socket.data.tokens.bearer).toBeDefined();
  });

  test("should reject refresh when store returns null", async () => {
    const ctx = buildCtx(`test_pylon_session=${SESSION_ID}`, mockProteus);

    await createConnectionSessionMiddleware(options)(ctx, next);

    (mockRepo.findOne as jest.Mock).mockResolvedValue(null);

    await expect(ctx.io.socket.data.pylon.auth.refresh({})).rejects.toThrow();
  });

  test("should reject refresh when reloaded session is past expiry", async () => {
    const ctx = buildCtx(`test_pylon_session=${SESSION_ID}`, mockProteus);

    await createConnectionSessionMiddleware(options)(ctx, next);

    (mockRepo.findOne as jest.Mock).mockResolvedValue(
      buildSession({ expiresAt: new Date("2000-01-01T00:00:00.000Z") }),
    );

    await expect(ctx.io.socket.data.pylon.auth.refresh({})).rejects.toThrow();
  });
});
