import { Scope } from "@lindorm-io/common-enums";
import { AesAlgorithm, createOpaqueToken as _createOpaqueToken } from "@lindorm-io/jwt";
import MockDate from "mockdate";
import { Client, ClientSession } from "../../entity";
import {
  createTestAccessToken,
  createTestClient,
  createTestClientSession,
  createTestRefreshToken,
} from "../../fixtures/entity";
import { getIdentityClaims as _getIdentityUserinfo } from "../identity";
import {
  createIdToken as _createIdToken,
  encryptIdToken as _encryptIdToken,
  generateAccessToken as _generateAccessToken,
  generateRefreshToken as _generateRefreshToken,
} from "../token";
import { generateTokenResponse } from "./generate-token-response";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("@lindorm-io/jwt");
jest.mock("../identity");
jest.mock("../token");

const createOpaqueToken = _createOpaqueToken as jest.Mock;
const createIdToken = _createIdToken as jest.Mock;
const encryptIdToken = _encryptIdToken as jest.Mock;
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
    client = createTestClient({
      idTokenEncryption: {
        algorithm: null,
        encryptionKeyAlgorithm: null,
      },
    });

    createOpaqueToken.mockReturnValue({ token: "create_opaque_token" });
    createIdToken.mockImplementation(() => ({
      token: "id.token.jwt",
    }));
    encryptIdToken.mockResolvedValue("encrypted.id.token.jwe");
    generateAccessToken.mockResolvedValue(createTestAccessToken());
    generateRefreshToken.mockResolvedValue(createTestRefreshToken());
    getIdentityUserinfo.mockResolvedValue({
      active: true,
      claims: { claim: true },
    });
  });

  afterEach(jest.resetAllMocks);

  test("should resolve body with access token", async () => {
    clientSession.scopes = [];

    await expect(generateTokenResponse(ctx, client, clientSession)).resolves.toStrictEqual({
      accessToken: "create_opaque_token",
      expiresIn: 86400,
      tokenType: "Bearer",
    });
  });

  test("should resolve body with id token", async () => {
    clientSession.scopes = [Scope.OPENID];

    await expect(generateTokenResponse(ctx, client, clientSession)).resolves.toStrictEqual(
      expect.objectContaining({
        idToken: "id.token.jwt",
        scope: "openid",
      }),
    );
  });

  test("should resolve body with encrypted id token", async () => {
    client.idTokenEncryption.algorithm = AesAlgorithm.AES_256_GCM;

    clientSession.scopes = [Scope.OPENID];

    await expect(generateTokenResponse(ctx, client, clientSession)).resolves.toStrictEqual(
      expect.objectContaining({
        idToken: "encrypted.id.token.jwe",
        scope: "openid",
      }),
    );
  });

  test("should resolve for refresh session", async () => {
    clientSession.scopes = [Scope.OFFLINE_ACCESS];

    await expect(generateTokenResponse(ctx, client, clientSession)).resolves.toStrictEqual({
      accessToken: "create_opaque_token",
      expiresIn: 86400,
      refreshToken: "create_opaque_token",
      scope: "offline_access",
      tokenType: "Bearer",
    });
  });
});
