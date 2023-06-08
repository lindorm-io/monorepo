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
          grantTypes: ["authorization_code"],
          responseTypes: ["code"],
          scopes: ["openid"],
        },
        audiences: {
          credentials: ["4cd74408-f64e-4d93-8ecd-cb2532a9acd1"],
          identity: ["3b50bab6-2962-4193-8d29-410795620df1"],
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
        backChannelLogoutUri: "https://backChannelLogoutUri",
        description: "updated description",
        frontChannelLogoutUri: "https://frontChannelLogoutUri",
        host: "https://host",
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
          grantTypes: ["authorization_code"],
          methods: [
            "bank_id_se",
            "device_link",
            "email",
            "mfa_cookie",
            "password",
            "phone",
            "recovery",
            "session_link",
            "totp",
            "webauthn",
          ],
          responseTypes: ["code"],
          scopes: ["openid"],
          strategies: [
            "bank_id_se",
            "device_challenge",
            "email_code",
            "email_otp",
            "mfa_cookie",
            "password",
            "password_browser_link",
            "phone_code",
            "phone_otp",
            "rdc_push_notification",
            "rdc_qr_code",
            "recovery_code",
            "session_display_code",
            "session_otp",
            "session_qr_code",
            "time_based_otp",
            "webauthn",
          ],
        },
        audiences: {
          credentials: ["4cd74408-f64e-4d93-8ecd-cb2532a9acd1"],
          identity: ["3b50bab6-2962-4193-8d29-410795620df1"],
        },
        backChannelLogoutUri: "https://backChannelLogoutUri",
        defaults: {
          displayMode: "wap",
          levelOfAssurance: 1,
          responseMode: "fragment",
        },
        description: "updated description",
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
