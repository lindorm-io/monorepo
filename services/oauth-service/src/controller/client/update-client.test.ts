import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { SCOPE_OPENID } from "../../constant";
import { createTestClient } from "../../fixtures/entity";
import { updateClientController } from "./update-client";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("updateClientController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        allowed: {
          codeChallengeMethods: ["plain"],
          grantTypes: ["authorization_code"],
          methods: ["email"],
          responseTypes: ["code"],
          scopes: ["openid"],
          strategies: ["email_otp"],
        },
        audiences: {
          credentials: ["4cd74408-f64e-4d93-8ecd-cb2532a9acd1"],
          identity: ["3b50bab6-2962-4193-8d29-410795620df1"],
        },
        customClaims: {
          uri: "https://claimsUri",
          username: "username",
          password: "password",
        },
        defaults: {
          audiences: ["429bc448-cc01-43db-90f2-486bc19c5018"],
          displayMode: "wap",
          levelOfAssurance: 1,
          responseMode: "fragment",
        },
        expiry: {
          accessToken: "33 seconds",
          idToken: "44 seconds",
          refreshToken: "55 seconds",
        },

        active: false,
        backchannelAuthCallbackUri: "https://backchannelAuthCallbackUri",
        backchannelAuthMode: "ping",
        backchannelLogoutUri: "https://backchannelLogoutUri",
        description: "updated description",
        domain: "https://domain",
        frontChannelLogoutUri: "https://frontChannelLogoutUri",
        logoUri: "https://logoUri",
        name: "updated-name",
        postLogoutUris: ["https://postLogoutUris"],
        profile: "updated profile",
        redirectUris: ["https://redirectUris"],
        requiredScopes: ["openid"],
        rtbfUri: "https://rtbfUri",
        scopeDescriptions: [SCOPE_OPENID],
        trusted: false,
        type: "updated type",
      },
      entity: {
        client: createTestClient({ id: "be664120-2430-4050-b56c-fd4176b652d9" }),
      },
      mongo: {
        clientRepository: createMockMongoRepository(createTestClient),
      },
    };
  });

  test("should resolve updated client", async () => {
    await expect(updateClientController(ctx)).resolves.toBeUndefined();

    expect(ctx.mongo.clientRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        active: false,
        allowed: {
          codeChallengeMethods: ["plain"],
          grantTypes: ["authorization_code"],
          methods: ["email"],
          responseTypes: ["code"],
          scopes: ["openid"],
          strategies: ["email_otp"],
        },
        audiences: {
          credentials: ["4cd74408-f64e-4d93-8ecd-cb2532a9acd1"],
          identity: ["3b50bab6-2962-4193-8d29-410795620df1"],
        },
        backchannelLogoutUri: "https://backchannelLogoutUri",
        customClaims: {
          uri: "https://claimsUri",
          username: "username",
          password: "password",
        },
        defaults: {
          displayMode: "wap",
          levelOfAssurance: 1,
          responseMode: "fragment",
        },
        description: "updated description",
        domain: "https://domain",
        expiry: {
          accessToken: "33 seconds",
          idToken: "44 seconds",
          refreshToken: "55 seconds",
        },
        frontChannelLogoutUri: "https://frontChannelLogoutUri",
        logoUri: "https://logoUri",
        name: "updated-name",
        postLogoutUris: ["https://postLogoutUris"],
        profile: "updated profile",
        redirectUris: ["https://redirectUris"],
        requiredScopes: ["openid"],
        rtbfUri: "https://rtbfUri",
        scopeDescriptions: [
          {
            description: "Give the client access to your OpenID claims.",
            name: "openid",
          },
        ],
        secret:
          "$argon2id$v=19$m=2048,t=32,p=2$gMJgh4L58ROHKxfiK12KRWTqX0Nz4xNrNJOZBHOvVYfvlDnnidbIq0iROKGR9Ugkhd0fqXntHZ0",
        singleSignOn: true,
        tenantId: expect.any(String),
        trusted: false,
        type: "updated type",
      }),
    );
  });
});
