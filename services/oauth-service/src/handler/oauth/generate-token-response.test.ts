import MockDate from "mockdate";
import { Client, ClientSession } from "../../entity";
import { OpenIdScope } from "@lindorm-io/common-types";
import { generateTokenResponse } from "./generate-token-response";
import { getIdentityClaims as _getIdentityUserinfo } from "../identity";
import {
  createTestAccessToken,
  createTestClient,
  createTestClientSession,
  createTestRefreshToken,
} from "../../fixtures/entity";
import {
  convertOpaqueTokenToJwt as _convertOpaqueTokenToJwt,
  createIdToken as _createIdToken,
  generateAccessToken as _generateAccessToken,
  generateRefreshToken as _generateRefreshToken,
} from "../token";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../identity");
jest.mock("../token");

const convertOpaqueTokenToJwt = _convertOpaqueTokenToJwt as jest.Mock;
const createIdToken = _createIdToken as jest.Mock;
const generateAccessToken = _generateAccessToken as jest.Mock;
const generateRefreshToken = _generateRefreshToken as jest.Mock;
const getIdentityUserinfo = _getIdentityUserinfo as jest.Mock;

describe("generateTokenResponse", () => {
  let ctx: any;
  let clientSession: ClientSession;
  let client: Client;

  beforeEach(() => {
    ctx = {};

    clientSession = createTestClientSession();
    client = createTestClient();

    convertOpaqueTokenToJwt.mockImplementation((_1, _2, token) => ({
      token: `${token.type}.token.jwt`,
    }));
    createIdToken.mockImplementation(() => ({
      token: "id.token.jwt",
    }));
    generateAccessToken.mockResolvedValue(
      createTestAccessToken({
        token: "opaque_access_token",
      }),
    );
    generateRefreshToken.mockResolvedValue(
      createTestRefreshToken({
        token: "opaque_refresh_token",
      }),
    );
    getIdentityUserinfo.mockResolvedValue({
      active: true,
      claims: { claim: true },
    });
  });

  afterEach(jest.resetAllMocks);

  test("should resolve body with access token", async () => {
    clientSession.scopes = [];

    await expect(generateTokenResponse(ctx, client, clientSession)).resolves.toStrictEqual({
      accessToken: "access_token.token.jwt",
      expiresIn: 86400,
      scope: [],
      tokenType: "Bearer",
    });
  });

  test("should resolve body with id token", async () => {
    clientSession.scopes = [OpenIdScope.OPENID];

    await expect(generateTokenResponse(ctx, client, clientSession)).resolves.toStrictEqual(
      expect.objectContaining({
        idToken: "id.token.jwt",
        scope: ["openid"],
      }),
    );
  });

  test("should resolve for refresh session", async () => {
    clientSession.scopes = [OpenIdScope.OFFLINE_ACCESS];

    await expect(generateTokenResponse(ctx, client, clientSession)).resolves.toStrictEqual({
      accessToken: "access_token.token.jwt",
      expiresIn: 86400,
      refreshToken: "refresh_token.token.jwt",
      scope: ["offline_access"],
      tokenType: "Bearer",
    });
  });

  test("should with opaque tokens", async () => {
    client.opaque = true;
    clientSession.scopes = [OpenIdScope.OFFLINE_ACCESS];

    await expect(generateTokenResponse(ctx, client, clientSession)).resolves.toStrictEqual({
      accessToken: "opaque_access_token",
      expiresIn: 86400,
      refreshToken: "opaque_refresh_token",
      scope: ["offline_access"],
      tokenType: "Bearer",
    });
  });
});
