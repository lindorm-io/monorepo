import { ClientError } from "@lindorm-io/errors";
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
        grantType: "authorization_code",
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
    ctx.data.grantType = "client_credentials";

    await expect(oauthTokenController(ctx)).resolves.toStrictEqual({
      body: "ClientCredentials",
    });
  });

  test("should resolve for refresh token", async () => {
    ctx.data.grantType = "refresh_token";

    await expect(oauthTokenController(ctx)).resolves.toStrictEqual({
      body: "RefreshToken",
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
