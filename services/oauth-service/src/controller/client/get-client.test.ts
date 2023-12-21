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
          codeChallengeMethods: ["plain", "S256"],
          grantTypes: [
            "urn:ietf:params:oauth:grant-type:authentication-token",
            "urn:ietf:params:oauth:grant-type:authorization-code",
            "urn:openid:params:grant-type:ciba",
            "urn:ietf:params:oauth:grant-type:client-credentials",
            "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "urn:ietf:params:oauth:grant-type:password",
            "urn:ietf:params:oauth:grant-type:refresh-token",
            "urn:ietf:params:oauth:grant-type:token-exchange",
            "authorization_code",
            "client_credentials",
            "password",
            "refresh_token",
          ],
          methods: [
            "urn:lindorm:auth:method:bank-id-se",
            "urn:lindorm:auth:method:device-link",
            "urn:lindorm:auth:method:email",
            "urn:lindorm:auth:method:mfa-cookie",
            "urn:lindorm:auth:method:password",
            "urn:lindorm:auth:method:phone",
            "urn:lindorm:auth:method:recovery",
            "urn:lindorm:auth:method:session-link",
            "urn:lindorm:auth:method:totp",
            "urn:lindorm:auth:method:webauthn",
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
            "urn:lindorm:auth:strategy:bank-id-se",
            "urn:lindorm:auth:strategy:device-challenge",
            "urn:lindorm:auth:strategy:email-code",
            "urn:lindorm:auth:strategy:email-otp",
            "urn:lindorm:auth:strategy:mfa-cookie",
            "urn:lindorm:auth:strategy:password",
            "urn:lindorm:auth:strategy:password-browser-link",
            "urn:lindorm:auth:strategy:phone-code",
            "urn:lindorm:auth:strategy:phone-otp",
            "urn:lindorm:auth:strategy:rdc-push-notification",
            "urn:lindorm:auth:strategy:rdc-qr-code",
            "urn:lindorm:auth:strategy:recovery-code",
            "urn:lindorm:auth:strategy:session-display-code",
            "urn:lindorm:auth:strategy:session-otp",
            "urn:lindorm:auth:strategy:session-qr-code",
            "urn:lindorm:auth:strategy:time-based-otp",
            "urn:lindorm:auth:strategy:webauthn",
          ],
        },
        audiences: {
          credentials: ["4cd74408-f64e-4d93-8ecd-cb2532a9acd1"],
          identity: ["3b50bab6-2962-4193-8d29-410795620df1"],
        },
        backchannelAuth: {
          mode: "poll",
          uri: "https://test.client.lindorm.io/backchannel-auth-callback",
          username: null,
          password: null,
        },
        backchannelLogoutUri: "https://test.client.lindorm.io/backchannel-logout",
        customClaims: {
          uri: "https://test.client.lindorm.io/claims",
          username: null,
          password: null,
        },
        defaults: {
          displayMode: "popup",
          levelOfAssurance: 3,
          responseMode: "query",
        },
        description: "Client description",
        domain: "https://test.client.lindorm.io",
        expiry: {
          accessToken: "99 seconds",
          idToken: "99 seconds",
          refreshToken: "99 seconds",
        },
        frontChannelLogoutUri: null,
        idTokenEncryption: {
          algorithm: "aes-256-gcm",
          encryptionKeyAlgorithm: "RSA-OAEP-256",
        },
        jwks: [],
        jwksUri: "https://test.client.lindorm.io/.well-known/jwks.json",
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
