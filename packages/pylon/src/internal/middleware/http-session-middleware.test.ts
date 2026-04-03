import { createMockLogger } from "@lindorm/logger";
import { createMockProteusSource, createMockRepository } from "@lindorm/proteus/mocks";
import { Next } from "@lindorm/middleware";
import MockDate from "mockdate";
import { PylonSessionOptions } from "../../types";
import { createHttpSessionMiddleware } from "./http-session-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

jest.mock("@lindorm/aegis", () => ({
  Aegis: class Aegis {
    public static parse() {
      return "parsed";
    }
  },
}));

describe("httpSessionMiddleware", () => {
  let ctx: any;
  let next: Next;
  let options: PylonSessionOptions;

  beforeEach(() => {
    const mockRepo = createMockRepository();
    const mockProteus = createMockProteusSource();
    mockProteus.repository.mockReturnValue(mockRepo);

    (mockRepo.insert as jest.Mock).mockImplementation((s: any) => Promise.resolve(s));
    (mockRepo.findOne as jest.Mock).mockResolvedValue({
      id: "cad4002a-bd04-52f1-9733-58866f421686",
      accessToken: "access_token",
      idToken: "id_token",
      refreshToken: "refresh_token",
    });
    (mockRepo.delete as jest.Mock).mockResolvedValue(undefined);

    ctx = {
      logger: createMockLogger(),
      proteus: mockProteus,
      cookies: {
        set: jest.fn(),
        get: jest.fn().mockReturnValue("cad4002a-bd04-52f1-9733-58866f421686"),
        del: jest.fn(),
      },
      amphora: {
        canEncrypt: jest.fn().mockReturnValue(false),
        canDecrypt: jest.fn().mockReturnValue(false),
      },
      aegis: { aes: { encrypt: jest.fn(), decrypt: jest.fn() } },
      state: {
        metadata: {},
        session: null,
        tokens: {},
      },
    };

    options = {
      enabled: true,
      encrypted: false,
      expiry: "90 minutes",
      httpOnly: true,
      sameSite: "strict",
      signed: true,
      name: "test_pylon_session",
    };

    next = () => Promise.resolve();
  });

  test("should set session with proteus store", async () => {
    await createHttpSessionMiddleware(options)(ctx, next);

    await ctx.session.set({
      id: "cad4002a-bd04-52f1-9733-58866f421686",
      accessToken: "access_token",
      idToken: "id_token",
      refreshToken: "refresh_token",
    });

    expect(ctx.cookies.set).toHaveBeenCalled();
  });

  test("should get session from proteus store", async () => {
    await createHttpSessionMiddleware(options)(ctx, next);

    expect(ctx.state.session).toEqual({
      id: "cad4002a-bd04-52f1-9733-58866f421686",
      accessToken: "access_token",
      idToken: "id_token",
      refreshToken: "refresh_token",
    });
  });

  test("should return null session when no proteus source", async () => {
    ctx.proteus = undefined;

    await createHttpSessionMiddleware(options)(ctx, next);

    expect(ctx.state.session).toBeNull();
  });

  test("should delete session", async () => {
    await createHttpSessionMiddleware(options)(ctx, next);

    await expect(ctx.session.del()).resolves.toBeUndefined();

    expect(ctx.cookies.del).toHaveBeenCalledWith("test_pylon_session");
  });
});
