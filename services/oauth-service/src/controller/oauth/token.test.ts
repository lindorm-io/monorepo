import { OpenIdGrantType } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { createTestClient } from "../../fixtures/entity";
import {
  handleAuthenticationTokenGrant as _handleAuthenticationTokenGrant,
  handleAuthorizationCodeGrant as _handleAuthorizationCodeGrant,
  handleClientCredentialsGrant as _handleClientCredentialsGrant,
  handleRefreshTokenGrant as _handleRefreshTokenGrant,
} from "../../handler";
import { oauthTokenController } from "./token";

jest.mock("../../handler");

const handleAuthenticationTokenGrant = _handleAuthenticationTokenGrant as jest.Mock;
const handleAuthorizationCodeGrant = _handleAuthorizationCodeGrant as jest.Mock;
const handleClientCredentialsGrant = _handleClientCredentialsGrant as jest.Mock;
const handleRefreshTokenGrant = _handleRefreshTokenGrant as jest.Mock;

describe("oauthTokenController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        grantType: "authorization_code",
      },
      entity: {
        client: createTestClient(),
      },
      set: jest.fn(),
    };

    handleAuthenticationTokenGrant.mockResolvedValue("handleAuthenticationTokenGrant");
    handleAuthorizationCodeGrant.mockResolvedValue("handleAuthorizationCodeGrant");
    handleClientCredentialsGrant.mockResolvedValue("handleClientCredentialsGrant");
    handleRefreshTokenGrant.mockResolvedValue("handleRefreshTokenGrant");
  });

  test("should resolve for AUTHENTICATION_TOKEN", async () => {
    ctx.data.grantType = OpenIdGrantType.AUTHENTICATION_TOKEN;

    await expect(oauthTokenController(ctx)).resolves.toStrictEqual({
      body: "handleAuthenticationTokenGrant",
    });
  });

  test("should resolve for AUTHORIZATION_CODE", async () => {
    ctx.data.grantType = OpenIdGrantType.AUTHORIZATION_CODE;

    await expect(oauthTokenController(ctx)).resolves.toStrictEqual({
      body: "handleAuthorizationCodeGrant",
    });
  });

  test("should resolve for CLIENT_CREDENTIALS", async () => {
    ctx.data.grantType = OpenIdGrantType.CLIENT_CREDENTIALS;

    await expect(oauthTokenController(ctx)).resolves.toStrictEqual({
      body: "handleClientCredentialsGrant",
    });
  });

  test("should resolve for REFRESH_TOKEN", async () => {
    ctx.data.grantType = OpenIdGrantType.REFRESH_TOKEN;

    await expect(oauthTokenController(ctx)).resolves.toStrictEqual({
      body: "handleRefreshTokenGrant",
    });
  });

  test("should reject on invalid grant type", async () => {
    ctx.entity.client = createTestClient({
      allowed: {
        ...ctx.entity.client,
        grantTypes: ["client_credentials"],
      },
    });

    ctx.data.grantType = OpenIdGrantType.REFRESH_TOKEN;

    await expect(oauthTokenController(ctx)).rejects.toThrow(ClientError);
  });
});
