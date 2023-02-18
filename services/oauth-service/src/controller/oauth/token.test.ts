import { ClientError } from "@lindorm-io/errors";
import { createTestClient } from "../../fixtures/entity";
import { oauthTokenController } from "./token";
import {
  handleAuthorizationCodeGrant as _handleAuthorizationCodeGrant,
  handleClientCredentialsGrant as _handleClientCredentialsGrant,
  handleRefreshTokenGrant as _handleRefreshTokenGrant,
} from "../../handler";

jest.mock("../../handler");

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
    };

    handleAuthorizationCodeGrant.mockResolvedValue("handleAuthorizationCodeGrant");
    handleClientCredentialsGrant.mockResolvedValue("handleClientCredentialsGrant");
    handleRefreshTokenGrant.mockResolvedValue("handleRefreshTokenGrant");
  });

  test("should resolve for authorization code", async () => {
    await expect(oauthTokenController(ctx)).resolves.toStrictEqual({
      body: "handleAuthorizationCodeGrant",
    });
  });

  test("should resolve for client credentials", async () => {
    ctx.data.grantType = "client_credentials";

    await expect(oauthTokenController(ctx)).resolves.toStrictEqual({
      body: "handleClientCredentialsGrant",
    });
  });

  test("should resolve for refresh token", async () => {
    ctx.data.grantType = "refresh_token";

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

    ctx.data.grantType = "refresh_token";

    await expect(oauthTokenController(ctx)).rejects.toThrow(ClientError);
  });
});
