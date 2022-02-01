import MockDate from "mockdate";
import request from "supertest";
import { koa } from "../../server/koa";
import { setupIntegration } from "../../test/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("/.well-known", () => {
  beforeAll(setupIntegration);

  test("GET /openid-configuration", async () => {
    const response = await request(koa.callback())
      .get("/.well-known/openid-configuration")
      .expect(200);

    expect(response.body).toStrictEqual({
      authorization_endpoint: "https://oauth.test.api.lindorm.io/oauth2/authorize",
      backchannel_logout_session_supported: true,
      backchannel_logout_supported: true,
      claims_parameter_supported: false,
      grant_types_supported: ["authorization_code", "client_credentials", "refresh_token"],
      id_token_encryption_alg_values_supported: [],
      id_token_encryption_enc_values_supported: [],
      id_token_signing_alg_values_supported: ["ES512", "RS512"],
      issuer: "https://oauth.test.api.lindorm.io",
      jwks_uri: "https://oauth.test.api.lindorm.io/.well-known/jwks.json",
      logout_endpoint: "https://oauth.test.api.lindorm.io/oauth2/sessions/logout",
      request_parameter_supported: false,
      request_uri_parameter_supported: true,
      response_types_supported: ["code", "id_token", "token"],
      revoke_endpoint: "https://oauth.test.api.lindorm.io/oauth2/sessions/revoke",
      scopes_supported: ["address", "email", "offline_access", "openid", "phone", "profile"],
      subject_types_supported: ["identity", "client"],
      token_endpoint: "https://oauth.test.api.lindorm.io/oauth2/token",
      token_endpoint_auth_methods_supported: [],
      token_endpoint_auth_signing_alg_values_supported: ["ES512", "RS512"],
      tokeninfo_endpoint: "https://oauth.test.api.lindorm.io/tokeninfo",
      userinfo_endpoint: "https://oauth.test.api.lindorm.io/userinfo",
    });
  });

  test("GET /jwks.json", async () => {
    const response = await request(koa.callback()).get("/.well-known/jwks.json").expect(200);

    expect(response.body).toStrictEqual({
      keys: [
        {
          alg: "ES512",
          allowed_from: 1577869200,
          created_at: 1577865600,
          crv: "P-521",
          expires_at: 1641024000,
          key_ops: ["sign", "verify"],
          kid: expect.any(String),
          kty: "EC",
          use: "sig",
          x: "AHxwF8PAKLjUbiRVbhXdjzqcgwwLKljN87yBiOlLT3WXGQyChNFLcszWnrkpB/AGiWtYh1Wtts4gsBJ/Tp9CwfDm",
          y: "AS3iydW4wE74tLql6xf28DxBPUuNfvlerYiectjVVOh42bGS4z6gNmCoc5jDN9SG77NloDkC4SSo+LjtMD2IJJhV",
        },
      ],
    });
  });
});
