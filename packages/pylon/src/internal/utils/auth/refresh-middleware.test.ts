import { ClientError } from "@lindorm/errors";
import MockDate from "mockdate";
import { getAuthClient as _getAuthClient } from "./get-auth-client";
import { parseTokenData as _parseTokenData } from "./parse-token-data";
import { createRefreshMiddleware } from "./refresh-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

jest.mock("./get-auth-client");
jest.mock("./parse-token-data");

const getAuthClient = _getAuthClient as jest.Mock;
const parseTokenData = _parseTokenData as jest.Mock;

describe("createRefreshMiddleware", () => {
  let config: any;
  let ctx: any;

  beforeEach(() => {
    config = {
      refresh: {
        maxAge: "12h",
        mode: "force",
      },
    };

    ctx = {
      session: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
      },
      state: {
        session: {
          id: "a6d36ab7-ab36-52a8-b366-5f5f21f8280e",
          accessToken: "accessToken",
          expiresAt: Date.now() + 43200 * 1000,
          idToken: "idToken",
          issuedAt: Date.now() - 43200 * 1000,
          refreshToken: "refreshToken",
          scope: ["scope"],
          subject: "9fb829a7-964e-56a3-9176-809cb357546c",
        },
      },
    };

    getAuthClient.mockReturnValue({
      token: jest.fn().mockResolvedValue({ data: true }),
    });

    parseTokenData.mockReturnValue("parsedTokenData");
  });

  afterEach(jest.clearAllMocks);

  test("should resolve force", async () => {
    await expect(
      createRefreshMiddleware(config)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.session.set).toHaveBeenCalled();
  });

  test("should resolve half_life", async () => {
    config.refresh.mode = "half_life";

    await expect(
      createRefreshMiddleware(config)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.session.set).toHaveBeenCalled();
  });

  test("should resolve max_age", async () => {
    config.refresh.mode = "max_age";

    await expect(
      createRefreshMiddleware(config)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.session.set).toHaveBeenCalled();
  });

  test("should not resolve max_age", async () => {
    config.refresh.maxAge = "43201s";
    config.refresh.mode = "max_age";

    await expect(
      createRefreshMiddleware(config)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.session.set).not.toHaveBeenCalled();
  });

  test("should not resolve none", async () => {
    config.refresh.mode = "none";

    await expect(
      createRefreshMiddleware(config)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.session.set).not.toHaveBeenCalled();
  });

  test("should throw on missing session", async () => {
    ctx.state.session = null;

    await expect(createRefreshMiddleware(config)(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );
  });
});
