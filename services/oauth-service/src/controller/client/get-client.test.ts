import MockDate from "mockdate";
import { createTestClient } from "../../fixtures/entity";
import { getClientController } from "./get-client";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getClientInfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        client: createTestClient({
          audiences: {
            credentials: ["4cd74408-f64e-4d93-8ecd-cb2532a9acd1"],
            identity: ["3b50bab6-2962-4193-8d29-410795620df1"],
          },
        }),
      },
    };
  });

  test("should resolve client", async () => {
    await expect(getClientController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        allowed: {
          grantTypes: [
            "urn:ietf:params:oauth:grant-type:authentication-token",
            "authorization_code",
            "client_credentials",
            "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "password",
            "refresh_token",
            "urn:ietf:params:oauth:grant-type:token-exchange",
          ],
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
        backChannelLogoutUri: "https://test.client.lindorm.io/back-channel-logout",
        defaults: {
          displayMode: "popup",
          levelOfAssurance: 3,
          responseMode: "query",
        },
        description: "Client description",
        expiry: {
          accessToken: "99 seconds",
          idToken: "99 seconds",
          refreshToken: "99 seconds",
        },
        frontChannelLogoutUri: null,
        host: "https://test.client.lindorm.io",
        logoUri: "https://logo.uri/logo",
        name: "ClientName",
        profile: "user_agent_based_application",
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
        singleSignOn: true,
        tenantId: expect.any(String),
        trusted: true,
        type: "confidential",
      },
    });
  });
});
