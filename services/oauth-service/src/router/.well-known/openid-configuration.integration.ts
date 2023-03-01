import MockDate from "mockdate";
import request from "supertest";
import { server } from "../../server/server";
import { setupIntegration } from "../../fixtures/integration";

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
      claims_supported: [
        "aal",
        "acr",
        "address",
        "amr",
        "aud",
        "auth_time",
        "azp",
        "birth_date",
        "display_name",
        "email",
        "email_verified",
        "exp",
        "ext",
        "family_name",
        "gender",
        "given_name",
        "avatar_uri",
        "iat",
        "iss",
        "jti",
        "loa",
        "locale",
        "middle_name",
        "name",
        "national_identity_number",
        "national_identity_number_verified",
        "nbf",
        "nickname",
        "nonce",
        "phone_number",
        "phone_number_verified",
        "picture",
        "preferred_accessibility",
        "preferred_username",
        "profile",
        "pronouns",
        "scp",
        "sid",
        "sih",
        "social_security_number",
        "social_security_number_verified",
        "sub",
        "suh",
        "taken_name",
        "tid",
        "token_type",
        "usr",
        "website",
        "zone_info",
      ],
      end_session_endpoint: "https://oauth.test.lindorm.io/oauth2/sessions/logout",
      grant_types_supported: ["authorization_code", "client_credentials", "refresh_token"],
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
        "accessibility",
        "address",
        "email",
        "national_identity_number",
        "offline_access",
        "openid",
        "phone",
        "profile",
        "public",
        "social_security_number",
        "username",
      ],
      subject_types_supported: ["identity", "client"],
      token_endpoint: "https://oauth.test.lindorm.io/oauth2/token",
      token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
      token_endpoint_auth_signing_alg_values_supported: ["ES512", "RS512"],
      tokeninfo_endpoint: "https://oauth.test.lindorm.io/tokeninfo",
      userinfo_endpoint: "https://oauth.test.lindorm.io/userinfo",
    });
  });
});
