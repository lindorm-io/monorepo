import { ClientError } from "@lindorm-io/errors";
import { GrantType } from "../../common";
import { createTestClient } from "../../fixtures/entity";
import { oauthTokenController } from "./token";

jest.mock("../../handler", () => ({
  handleAuthorizationCodeGrant: jest.fn().mockResolvedValue("AuthorizationCode"),
  handleClientCredentialsGrant: jest.fn().mockResolvedValue("ClientCredentials"),
  handleRefreshTokenGrant: jest.fn().mockResolvedValue("RefreshToken"),
}));

describe("oauthTokenController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        grantType: GrantType.AUTHORIZATION_CODE,
      },
      entity: {
        client: createTestClient(),
      },
    };
  });

  test("should resolve for authorization code", async () => {
    await expect(oauthTokenController(ctx)).resolves.toStrictEqual({
      body: "AuthorizationCode",
    });
  });

  test("should resolve for client credentials", async () => {
    ctx.data.grantType = GrantType.CLIENT_CREDENTIALS;

    await expect(oauthTokenController(ctx)).resolves.toStrictEqual({
      body: "ClientCredentials",
    });
  });

  test("should resolve for refresh token", async () => {
    ctx.data.grantType = GrantType.REFRESH_TOKEN;

    await expect(oauthTokenController(ctx)).resolves.toStrictEqual({
      body: "RefreshToken",
    });
  });

  test("should reject on invalid grant type", async () => {
    ctx.entity.client = createTestClient({
      allowed: {
        ...ctx.entity.client,
        grantTypes: [GrantType.CLIENT_CREDENTIALS],
      },
    });

    ctx.data.grantType = GrantType.REFRESH_TOKEN;

    await expect(oauthTokenController(ctx)).rejects.toThrow(ClientError);
  });
});
