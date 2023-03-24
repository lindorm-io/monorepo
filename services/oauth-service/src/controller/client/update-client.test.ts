import MockDate from "mockdate";
import { SCOPE_OPENID } from "../../constant";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTestClient } from "../../fixtures/entity";
import { updateClientController } from "./update-client";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("updateClientController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        allowed: {
          grantTypes: ["authorization_code"],
          responseTypes: ["code"],
          scopes: ["openid"],
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
        audiences: ["429bc448-cc01-43db-90f2-486bc19c5018"],
        backChannelLogoutUri: "https://backChannelLogoutUri",
        enforceBasicAuth: true,
        enforceSecret: true,
        frontChannelLogoutUri: "https://frontChannelLogoutUri",
        host: "https://host",
        logoUri: "https://logoUri",
        name: "updated-name",
        postLogoutUris: ["https://postLogoutUris"],
        redirectUris: ["https://redirectUris"],
        rtbfUri: "https://rtbfUri",
        type: "updated type",
        description: "updated description",
        requiredScopes: ["openid"],
        scopeDescriptions: [SCOPE_OPENID],
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
          grantTypes: ["authorization_code"],
          responseTypes: ["code"],
          scopes: ["openid"],
        },
        backChannelLogoutUri: "https://backChannelLogoutUri",
        defaults: {
          audiences: ["429bc448-cc01-43db-90f2-486bc19c5018"],
          displayMode: "wap",
          levelOfAssurance: 1,
          responseMode: "fragment",
        },
        description: "updated description",
        enforceBasicAuth: true,
        enforceSecret: true,
        expiry: {
          accessToken: "33 seconds",
          idToken: "44 seconds",
          refreshToken: "55 seconds",
        },
        frontChannelLogoutUri: "https://frontChannelLogoutUri",
        host: "https://host",
        logoUri: "https://logoUri",
        name: "updated-name",
        postLogoutUris: ["https://postLogoutUris"],
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
        tenantId: "d1b90ac7-69a6-4187-92f2-46e9dceccde9",
        type: "updated type",
      }),
    );
  });
});
