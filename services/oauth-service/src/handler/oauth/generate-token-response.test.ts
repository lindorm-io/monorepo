import { BrowserSession, Client } from "../../entity";
import { Scope } from "../../common";
import { generateTokenResponse } from "./generate-token-response";
import { getIdentityUserinfo as _getIdentityUserinfo } from "../identity";
import {
  createTestBrowserSession,
  createTestClient,
  createTestRefreshSession,
} from "../../fixtures/entity";
import {
  createAccessToken as _createAccessToken,
  createIdToken as _createIdToken,
  createRefreshToken as _createRefreshToken,
} from "../token";

jest.mock("../identity");
jest.mock("../token");

const createAccessToken = _createAccessToken as jest.Mock;
const createIdToken = _createIdToken as jest.Mock;
const createRefreshToken = _createRefreshToken as jest.Mock;
const getIdentityUserinfo = _getIdentityUserinfo as jest.Mock;

describe("generateTokenResponse", () => {
  let ctx: any;
  let browserSession: BrowserSession;
  let client: Client;
  let scopes: Array<string>;

  beforeEach(() => {
    ctx = {};

    browserSession = createTestBrowserSession();

    client = createTestClient();

    scopes = [];

    createAccessToken.mockImplementation(() => ({
      token: "access.token.jwt",
      expiresIn: 999,
    }));
    createIdToken.mockImplementation(() => ({
      token: "id.token.jwt",
      expiresIn: 999,
    }));
    createRefreshToken.mockImplementation(() => ({
      token: "refresh.token.jwt",
      expiresIn: 999,
    }));
    getIdentityUserinfo.mockResolvedValue({
      active: true,
      claims: { claim: true },
      permissions: ["permissions"],
    });
  });

  afterEach(jest.resetAllMocks);

  test("should resolve body with access token", async () => {
    await expect(generateTokenResponse(ctx, client, browserSession, scopes)).resolves.toStrictEqual(
      {
        accessToken: "access.token.jwt",
        expiresIn: 999,
        scope: [],
        tokenType: "Bearer",
      },
    );
  });

  test("should resolve body with id token", async () => {
    scopes = [Scope.OPENID];

    await expect(generateTokenResponse(ctx, client, browserSession, scopes)).resolves.toStrictEqual(
      expect.objectContaining({
        idToken: "id.token.jwt",
        scope: ["openid"],
      }),
    );
  });

  test("should resolve for refresh session", async () => {
    scopes = [Scope.OFFLINE_ACCESS];

    await expect(
      generateTokenResponse(ctx, client, createTestRefreshSession(), scopes),
    ).resolves.toStrictEqual({
      accessToken: "access.token.jwt",
      expiresIn: 999,
      refreshToken: "refresh.token.jwt",
      scope: ["offline_access"],
      tokenType: "Bearer",
    });
  });
});
