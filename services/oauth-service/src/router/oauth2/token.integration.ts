import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  OpenIdGrantType,
  SessionStatus,
} from "@lindorm-io/common-enums";
import { baseHash } from "@lindorm-io/core";
import { KeyPairAlgorithm } from "@lindorm-io/key-pair";
import { randomHex } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { getUnixTime } from "date-fns";
import jwt from "jsonwebtoken";
import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { ClientSessionType } from "../../enum";
import { TEST_GET_USERINFO_RESPONSE, getTestData } from "../../fixtures/data";
import {
  createTestAuthorizationCode,
  createTestAuthorizationSession,
  createTestBackchannelSession,
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
  createTestRefreshToken,
  createTestTenant,
} from "../../fixtures/entity";
import {
  TEST_ARGON,
  TEST_AUTHORIZATION_CODE_CACHE,
  TEST_AUTHORIZATION_SESSION_CACHE,
  TEST_BACKCHANNEL_SESSION_CACHE,
  TEST_BROWSER_SESSION_REPOSITORY,
  TEST_CLIENT_REPOSITORY,
  TEST_CLIENT_SESSION_REPOSITORY,
  TEST_OPAQUE_TOKEN_CACHE,
  TEST_TENANT_REPOSITORY,
  setupIntegration,
} from "../../fixtures/integration";
import { configuration } from "../../server/configuration";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth2/token", () => {
  beforeAll(setupIntegration);

  nock("https://authentication.test.lindorm.io")
    .get("/admin/grant-types/authentication-token")
    .query(true)
    .times(1)
    .reply(200, {
      factors: [AuthenticationFactor.ONE_FACTOR],
      identityId: randomUUID(),
      latestAuthentication: new Date().toISOString(),
      levelOfAssurance: 2,
      methods: [AuthenticationMethod.EMAIL],
      nonce: randomHex(16),
      strategies: [AuthenticationStrategy.EMAIL_CODE],
    });

  nock("https://authentication.test.lindorm.io")
    .post("/admin/grant-types/password")
    .query(true)
    .times(1)
    .reply(200, {
      factors: [AuthenticationFactor.ONE_FACTOR],
      identityId: randomUUID(),
      latestAuthentication: new Date().toISOString(),
      levelOfAssurance: 2,
      methods: [AuthenticationMethod.EMAIL],
      nonce: randomHex(16),
      strategies: [AuthenticationStrategy.EMAIL_CODE],
    });

  nock("https://identity.test.lindorm.io")
    .get("/admin/claims")
    .query(true)
    .times(999)
    .reply(200, TEST_GET_USERINFO_RESPONSE);

  nock("https://test.client.lindorm.io")
    .get("/claims")
    .query(true)
    .times(999)
    .reply(200, { extraClientClaim: "extraClientClaim" });

  nock("https://test.client.lindorm.io")
    .get("/.well-known/jwks.json")
    .query(true)
    .times(999)
    .reply(200, {
      keys: [
        {
          alg: "RS512",
          keyOps: ["decrypt", "encrypt", "verify"],
          kid: "2d60172d-ac8a-4eaf-8ccd-873fc22dcb28",
          kty: "RSA",
          use: "sig",
          n: "yjql5hIlllH81iamrW5BtOjIc9TKD0+dMazmKhKq/waqKcYtgI06p4YmF940f3OW8dKKXRLBbvu++VBN6/RMP9JFpYg1r4U1UbqwDMFeRRFiMZgH86FW6KhhyECxkWm6/5NRdu7cEw5mNVi08i0MsxuvFWEvSTArBLP5Ctw9m3KNza/HRlO4oVPaiwtxadTlqyYsFr2cEwjZvAadrrj1tLiasCX/UcmBE5Csoo8hayUXdM9hofg2QBXYGKiRTCr5WnxIKfagmzhGdClmZw6C+/8QWogm3tREq52IX5DPwEjUJ0Lq2AZ2O7HMpMx0NwkwrDSysT6K+klphyrpe1WG0RvEzeSQ7jfRf5Xe997LPv5LB6nFz4HtOaVcM2sEGHqS9iPWByAX4Y+2zvQvbDQPAcpEVojPRWJeZLEYJUvIhEeZ5Q9pOobF0qKH3dxxZNSDCXkVSrne6au7sfSR7toqqnBSOTpWCluzw1SjYBKd6cP0tNgkjUEvJFb1QsAV3GNbppFch4LCc5/MSX07l1MdlZ44H8TYAA20VWmsYBW00EFRITe0bNIAxl5wos3NLduozOMZwWRXawDWUQqejeJjggM2QtO0yuRuvVFlhQqs5sHz8fsux7RIkE/gVDy51ai+hUQ4GL3o0ELSsLzfTzUhRvUqSW8/kAf5GZnygQgGrMs=",
          e: "AQAB",
        },
      ],
    });

  test("should resolve for authentication token grant type", async () => {
    const tenant = await TEST_TENANT_REPOSITORY.create(createTestTenant());
    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        secret: await TEST_ARGON.sign("secret"),
        tenantId: tenant.id,
      }),
    );

    const response = await request(server.callback())
      .post("/oauth2/token")
      .set("Authorization", `Basic ${baseHash(`${client.id}:secret`)}`)
      .send({
        grant_type: OpenIdGrantType.AUTHENTICATION_TOKEN,
        authentication_token: "authentication_token",
        scope: client.allowed.scopes.join(" "),
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      access_token: expect.any(String),
      expires_in: 99,
      id_token: expect.any(String),
      refresh_token: expect.any(String),
      scope:
        "address email offline_access openid phone profile accessibility national_identity_number public social_security_number username",
      token_type: "Bearer",
    });
  });

  test("should resolve for authorization code grant type", async () => {
    const { code, codeChallenge, codeChallengeMethod, codeVerifier, nonce, state } = getTestData();

    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        secret: await TEST_ARGON.sign("secret"),
      }),
    );

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());

    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        audiences: [configuration.oauth.client_id, client.id],
        browserSessionId: browserSession.id,
        identityId: browserSession.identityId,
        clientId: client.id,
        scopes: client.allowed.scopes,
      }),
    );

    const authorizationSession = await TEST_AUTHORIZATION_SESSION_CACHE.create(
      createTestAuthorizationSession({
        browserSessionId: browserSession.id,
        clientId: client.id,
        clientSessionId: clientSession.id,
        code: {
          codeChallenge,
          codeChallengeMethod,
        },
        nonce,
        state,
      }),
    );

    await TEST_AUTHORIZATION_CODE_CACHE.create(
      createTestAuthorizationCode({
        authorizationSessionId: authorizationSession.id,
        code,
        expires: new Date("2021-01-01T08:01:00.000Z"),
      }),
    );

    const response = await request(server.callback())
      .post("/oauth2/token")
      .set("Authorization", `Basic ${baseHash(`${client.id}:secret`)}`)
      .send({
        code,
        code_verifier: codeVerifier,
        grant_type: OpenIdGrantType.AUTHORIZATION_CODE,
        redirect_uri: authorizationSession.redirectUri,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      access_token: expect.any(String),
      expires_in: 99,
      id_token: expect.any(String),
      refresh_token: expect.any(String),
      scope:
        "address email offline_access openid phone profile accessibility national_identity_number public social_security_number username",
      token_type: "Bearer",
    });
  });

  test("should resolve for backchannel grant type", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        secret: await TEST_ARGON.sign("secret"),
      }),
    );

    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        audiences: [configuration.oauth.client_id, client.id],
        browserSessionId: null,
        clientId: client.id,
        identityId: randomUUID(),
        scopes: client.allowed.scopes,
      }),
    );

    const backchannelSession = await TEST_BACKCHANNEL_SESSION_CACHE.create(
      createTestBackchannelSession({
        clientId: client.id,
        clientSessionId: clientSession.id,
        status: {
          consent: SessionStatus.CONFIRMED,
          login: SessionStatus.CONFIRMED,
        },
      }),
    );

    const response = await request(server.callback())
      .post("/oauth2/token")
      .set("Authorization", `Basic ${baseHash(`${client.id}:secret`)}`)
      .send({
        auth_req_id: backchannelSession.id,
        grant_type: OpenIdGrantType.BACKCHANNEL_AUTHENTICATION,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      access_token: expect.any(String),
      expires_in: 99,
      id_token: expect.any(String),
      refresh_token: expect.any(String),
      scope:
        "address email offline_access openid phone profile accessibility national_identity_number public social_security_number username",
      token_type: "Bearer",
    });
  });

  test("should resolve for jwt bearer grant type", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        authenticationAssertion: {
          algorithm: KeyPairAlgorithm.HS256,
          issuer: "https://client.test.authentication.lindorm.io",
          secret: "9as5n79KR1woVTdqaJ0ZjADAMLSh2SLM",
        },
        authorizationAssertion: {
          algorithm: KeyPairAlgorithm.HS256,
          issuer: "https://client.test.authorization.lindorm.io",
          secret: "zVLezwFmrYWsyhuBkrnFSBiDtUfpSuHT",
        },
      }),
    );

    const clientAssertion = jwt.sign(
      {
        aud: configuration.oauth.client_id,
        exp: getUnixTime(new Date("2021-01-01T08:10:00.000Z")),
        iat: getUnixTime(new Date()),
        iss: "https://client.test.authentication.lindorm.io",
        jti: randomUUID(),
        sub: client.id,
      },
      client.authenticationAssertion.secret!,
    );

    const assertion = jwt.sign(
      {
        amr: ["pwd"],
        aud: configuration.oauth.client_id,
        exp: getUnixTime(new Date("2021-01-01T08:10:00.000Z")),
        iat: getUnixTime(new Date()),
        iss: "https://client.test.authorization.lindorm.io",
        jti: randomUUID(),
        sub: randomUUID(),
      },
      client.authorizationAssertion.secret!,
    );

    const response = await request(server.callback())
      .post("/oauth2/token")
      .set("Authorization", `Basic ${baseHash(`${client.id}:secret`)}`)
      .send({
        client_id: client.id,
        client_assertion: clientAssertion,
        client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        assertion,
        grant_type: OpenIdGrantType.JWT_BEARER,
        scope: "openid address email phone profile",
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      access_token: expect.any(String),
      expires_in: 99,
      id_token: expect.any(String),
      scope: "openid address email phone profile",
      token_type: "Bearer",
    });
  });

  test("should resolve for client credentials grant type", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        secret: await TEST_ARGON.sign("secret"),
      }),
    );

    const response = await request(server.callback())
      .post("/oauth2/token")
      .set("Authorization", `Basic ${baseHash(`${client.id}:secret`)}`)
      .send({
        grant_type: OpenIdGrantType.CLIENT_CREDENTIALS,
        scope: client.allowed.scopes.join(" "),
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      access_token: expect.any(String),
      expires_in: 60,
      scope:
        "address email offline_access openid phone profile accessibility national_identity_number public social_security_number username",
      token_type: "Bearer",
    });
  });

  test("should resolve for password grant type", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        secret: await TEST_ARGON.sign("secret"),
      }),
    );

    const response = await request(server.callback())
      .post("/oauth2/token")
      .set("Authorization", `Basic ${baseHash(`${client.id}:secret`)}`)
      .send({
        grant_type: OpenIdGrantType.PASSWORD,
        username: "username",
        password: "password",
        scope: client.allowed.scopes.join(" "),
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      access_token: expect.any(String),
      expires_in: 99,
      id_token: expect.any(String),
      refresh_token: expect.any(String),
      scope:
        "address email offline_access openid phone profile accessibility national_identity_number public social_security_number username",
      token_type: "Bearer",
    });
  });

  test("should resolve for refresh token grant type", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        secret: await TEST_ARGON.sign("secret"),
      }),
    );

    const browserSession = await TEST_BROWSER_SESSION_REPOSITORY.create(createTestBrowserSession());

    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(
      createTestClientSession({
        clientId: client.id,
        browserSessionId: browserSession.id,
        identityId: browserSession.identityId,
        audiences: [configuration.oauth.client_id, client.id],
        scopes: client.allowed.scopes,
        type: ClientSessionType.REFRESH,
      }),
    );

    const refreshToken = await TEST_OPAQUE_TOKEN_CACHE.create(
      createTestRefreshToken({
        clientSessionId: clientSession.id,
      }),
    );

    const response = await request(server.callback())
      .post("/oauth2/token")
      .set("Authorization", `Basic ${baseHash(`${client.id}:secret`)}`)
      .send({
        grant_type: OpenIdGrantType.REFRESH_TOKEN,
        refresh_token: refreshToken.signature,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      access_token: expect.any(String),
      expires_in: 99,
      id_token: expect.any(String),
      refresh_token: expect.any(String),
      scope:
        "address email offline_access openid phone profile accessibility national_identity_number public social_security_number username",
      token_type: "Bearer",
    });
  });
});
