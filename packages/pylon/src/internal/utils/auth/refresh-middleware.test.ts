import { ClientError } from "@lindorm/errors";
import MockDate from "mockdate";
import { parseTokenData as _parseTokenData } from "./parse-token-data";
import { createRefreshMiddleware } from "./refresh-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

jest.mock("./parse-token-data");

const parseTokenData = _parseTokenData as jest.Mock;

describe("createRefreshMiddleware", () => {
  let authConfig: any;
  let ctx: any;

  beforeEach(() => {
    authConfig = {
      refresh: {
        maxAge: "12h",
        mode: "force",
      },
      defaultTokenExpiry: "1d",
    };

    ctx = {
      aegis: {
        verify: jest.fn(),
      },
      auth: {
        token: jest.fn().mockResolvedValue({ data: true }),
      },
      logger: {
        warn: jest.fn(),
      },
      session: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
      },
      state: {
        session: {
          id: "a6d36ab7-ab36-52a8-b366-5f5f21f8280e",
          accessToken: "accessToken",
          expiresAt: new Date(Date.now() + 43200 * 1000),
          idToken: "idToken",
          issuedAt: new Date(Date.now() - 43200 * 1000),
          refreshToken: "refreshToken",
          scope: ["scope"],
          subject: "9fb829a7-964e-56a3-9176-809cb357546c",
        },
      },
    };

    parseTokenData.mockResolvedValue("parsedTokenData");
  });

  afterEach(jest.clearAllMocks);

  test("should resolve force", async () => {
    await expect(
      createRefreshMiddleware(authConfig)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.session.set).toHaveBeenCalled();
  });

  test("should resolve half_life", async () => {
    authConfig.refresh.mode = "half_life";

    await expect(
      createRefreshMiddleware(authConfig)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.session.set).toHaveBeenCalled();
  });

  test("should resolve max_age", async () => {
    authConfig.refresh.mode = "max_age";

    await expect(
      createRefreshMiddleware(authConfig)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.session.set).toHaveBeenCalled();
  });

  test("should not resolve max_age", async () => {
    authConfig.refresh.maxAge = "43201s";
    authConfig.refresh.mode = "max_age";

    await expect(
      createRefreshMiddleware(authConfig)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.session.set).not.toHaveBeenCalled();
  });

  test("should not resolve none", async () => {
    authConfig.refresh.mode = "none";

    await expect(
      createRefreshMiddleware(authConfig)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.session.set).not.toHaveBeenCalled();
  });

  test("should throw on missing session", async () => {
    ctx.state.session = null;

    await expect(createRefreshMiddleware(authConfig)(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );
  });
});
