import MockDate from "mockdate";
import request from "supertest";
import { server } from "../../server/server";
import { setupIntegration } from "../../fixtures/integration";
import { GrantType, Scope } from "../../common";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/.well-known/openid-configuration", () => {
  beforeAll(setupIntegration);

  test("GET /", async () => {
    const response = await request(server.callback())
      .get("/.well-known/openid-configuration")
      .expect(200);

    expect(response.body).toStrictEqual({
      authorization_endpoint: "https://oauth.test.lindorm.io/oauth2/authorize",
      backchannel_logout_session_supported: true,
      backchannel_logout_supported: true,
      claims_parameter_supported: false,
      grant_types_supported: [
        GrantType.AUTHORIZATION_CODE,
        GrantType.CLIENT_CREDENTIALS,
        GrantType.REFRESH_TOKEN,
      ],
      id_token_encryption_alg_values_supported: [],
      id_token_encryption_enc_values_supported: [],
      id_token_signing_alg_values_supported: ["ES512", "RS512"],
      issuer: "https://oauth.test.lindorm.io",
      jwks_uri: "https://oauth.test.lindorm.io/.well-known/jwks.json",
      logout_endpoint: "https://oauth.test.lindorm.io/oauth2/sessions/logout",
      request_parameter_supported: false,
      request_uri_parameter_supported: true,
      response_types_supported: [
        "code",
        "id_token",
        "token",
        "code id_token",
        "code token",
        "id_token token",
        "code id_token token",
      ],
      revoke_endpoint: "https://oauth.test.lindorm.io/oauth2/sessions/revoke",
      scopes_supported: [
        Scope.OPENID,
        Scope.ADDRESS,
        Scope.EMAIL,
        Scope.PHONE,
        Scope.PROFILE,

        Scope.ACCESSIBILITY,
        Scope.CONNECTED_PROVIDERS,
        Scope.NATIONAL_IDENTITY_NUMBER,
        Scope.SOCIAL_SECURITY_NUMBER,
        Scope.USERNAME,

        Scope.OFFLINE_ACCESS,
      ],
      subject_types_supported: ["identity", "client"],
      token_endpoint: "https://oauth.test.lindorm.io/oauth2/token",
      token_endpoint_auth_methods_supported: [],
      token_endpoint_auth_signing_alg_values_supported: ["ES512", "RS512"],
      tokeninfo_endpoint: "https://oauth.test.lindorm.io/tokeninfo",
      userinfo_endpoint: "https://oauth.test.lindorm.io/userinfo",
    });
  });
});
