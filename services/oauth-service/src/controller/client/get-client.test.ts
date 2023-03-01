import MockDate from "mockdate";
import { getClientController } from "./get-client";
import { createTestClient } from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getClientInfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        client: createTestClient(),
      },
    };
  });

  test("should resolve client", async () => {
    await expect(getClientController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        allowed: {
          grantTypes: ["authorization_code", "client_credentials", "refresh_token"],
          responseTypes: ["code", "id_token", "token"],
          scopes: expect.arrayContaining([
            "address",
            "email",
            "offline_access",
            "openid",
            "phone",
            "profile",
            "accessibility",
            "national_identity_number",
            "public",
            "social_security_number",
            "username",
          ]),
        },
        backChannelLogoutUri: "https://test.client.lindorm.io/back-channel-logout",
        defaults: {
          audiences: [],
          displayMode: "popup",
          levelOfAssurance: 3,
          responseMode: "query",
        },
        description: "Client description",
        enforceBasicAuth: false,
        enforceSecret: false,
        expiry: {
          accessToken: "99 seconds",
          idToken: "99 seconds",
          refreshToken: "99 seconds",
        },
        frontChannelLogoutUri: null,
        host: "https://test.client.lindorm.io",
        logoUri: "https://logo.uri/logo",
        name: "ClientName",
        postLogoutUris: ["https://test.client.lindorm.io/logout"],
        redirectUris: ["https://test.client.lindorm.io/redirect"],
        requiredScopes: ["offline_access", "openid"],
        rtbfUri: "https://test.client.lindorm.io/rtbf",
        scopeDescriptions: [
          {
            description: "Give the client access to your OpenID claims.",
            name: "openid",
          },
          {
            description: "Give the client access to your profile information.",
            name: "profile",
          },
        ],
        tenantId: "d1b90ac7-69a6-4187-92f2-46e9dceccde9",
        type: "confidential",
      },
    });
  });
});
