import { AccessSession, Client, RefreshSession } from "../../entity";
import { generateTokenResponse } from "./generate-token-response";
import { getIdentityClaims as _getIdentityUserinfo } from "../identity";
import {
  createTestAccessSession,
  createTestClient,
  createTestRefreshSession,
} from "../../fixtures/entity";
import {
  createAccessToken as _createAccessToken,
  createIdToken as _createIdToken,
  createRefreshToken as _createRefreshToken,
} from "../token";
import { OpenIdScope } from "@lindorm-io/common-types";

jest.mock("../identity");
jest.mock("../token");

const createAccessToken = _createAccessToken as jest.Mock;
const createIdToken = _createIdToken as jest.Mock;
const createRefreshToken = _createRefreshToken as jest.Mock;
const getIdentityUserinfo = _getIdentityUserinfo as jest.Mock;

describe("generateTokenResponse", () => {
  let ctx: any;
  let accessSession: AccessSession;
  let refreshSession: RefreshSession;
  let client: Client;

  beforeEach(() => {
    ctx = {};

    accessSession = createTestAccessSession();
    refreshSession = createTestRefreshSession();
    client = createTestClient();

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
    });
  });

  afterEach(jest.resetAllMocks);

  test("should resolve body with access token", async () => {
    accessSession.scopes = [];

    await expect(generateTokenResponse(ctx, client, accessSession)).resolves.toStrictEqual({
      accessToken: "access.token.jwt",
      expiresIn: 999,
      scope: [],
      tokenType: "Bearer",
    });
  });

  test("should resolve body with id token", async () => {
    accessSession.scopes = [OpenIdScope.OPENID];

    await expect(generateTokenResponse(ctx, client, accessSession)).resolves.toStrictEqual(
      expect.objectContaining({
        idToken: "id.token.jwt",
        scope: ["openid"],
      }),
    );
  });

  test("should resolve for refresh session", async () => {
    refreshSession.scopes = [OpenIdScope.OFFLINE_ACCESS];

    await expect(generateTokenResponse(ctx, client, refreshSession)).resolves.toStrictEqual({
      accessToken: "access.token.jwt",
      expiresIn: 999,
      refreshToken: "refresh.token.jwt",
      scope: ["offline_access"],
      tokenType: "Bearer",
    });
  });
});
