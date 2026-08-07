import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import {
  createMockProteusSource,
  createMockRepository,
} from "@lindorm/proteus/mocks/vitest";
import type { Next } from "@lindorm/middleware";
import MockDate from "mockdate";
import type { PylonSessionSettings } from "../../types/index.js";
import { createHttpSessionMiddleware } from "./http-session-middleware.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("httpSessionMiddleware", () => {
  let ctx: any;
  let mockProteus: Awaited<ReturnType<typeof createMockProteusSource>>;
  let next: Next;
  let options: PylonSessionSettings;

  beforeEach(async () => {
    const mockRepo = await createMockRepository();
    mockProteus = await createMockProteusSource();
    // The store opens its own request-scoped session off the SOURCE: this
    // middleware runs BEFORE the dependencies middleware that installs `ctx.kv`.
    mockProteus.session.mockReturnValue({
      repository: vi.fn().mockReturnValue(mockRepo),
    } as any);

    (mockRepo.insert as Mock).mockImplementation((s: any) => Promise.resolve(s));
    (mockRepo.findOne as Mock).mockResolvedValue({
      id: "cad4002a-bd04-52f1-9733-58866f421686",
      accessToken: "access_token",
      idToken: "id_token",
      refreshToken: "refresh_token",
    });
    (mockRepo.delete as Mock).mockResolvedValue(undefined);

    ctx = {
      logger: createMockLogger(),
      cookies: {
        set: vi.fn(),
        get: vi.fn().mockReturnValue("cad4002a-bd04-52f1-9733-58866f421686"),
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
        metadata: {},
        session: null,
        tokens: {},
      },
    };

    options = {
      enabled: true,
      sameSite: "strict",
    };

    next = () => Promise.resolve();
  });

  test("should set session with keyValue store", async () => {
    await createHttpSessionMiddleware(mockProteus, options)(ctx, next);

    await ctx.session.set({
      id: "cad4002a-bd04-52f1-9733-58866f421686",
      accessToken: "access_token",
      idToken: "id_token",
      refreshToken: "refresh_token",
    });

    expect(ctx.cookies.set).toHaveBeenCalled();
  });

  test("should get session from keyValue store", async () => {
    await createHttpSessionMiddleware(mockProteus, options)(ctx, next);

    expect(ctx.state.session).toEqual({
      id: "cad4002a-bd04-52f1-9733-58866f421686",
      accessToken: "access_token",
      idToken: "id_token",
      refreshToken: "refresh_token",
    });
  });

  // No kv source ⇒ no store ⇒ cookie-only: the whole session object is the
  // cookie's value, written and read straight through.
  test("should read the session out of the cookie when no kv source is configured", async () => {
    const cookieOnly = {
      id: "cad4002a-bd04-52f1-9733-58866f421686",
      accessToken: "access_token",
      expiresAt: null,
      issuedAt: MockedDate,
      scope: [],
      subject: "sub-1",
    };

    ctx.cookies.get.mockResolvedValue(cookieOnly);

    await createHttpSessionMiddleware(undefined, options)(ctx, next);

    expect(ctx.state.session).toEqual(cookieOnly);

    await ctx.session.set(cookieOnly);

    expect(ctx.cookies.set).toHaveBeenCalledWith(
      "pylon_session",
      cookieOnly,
      expect.anything(),
    );
  });

  test("should delete session", async () => {
    await createHttpSessionMiddleware(mockProteus, options)(ctx, next);

    await expect(ctx.session.del()).resolves.toBeUndefined();

    expect(ctx.cookies.del).toHaveBeenCalledWith("pylon_session");
  });
});
