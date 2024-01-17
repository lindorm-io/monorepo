import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  OpenIdBackchannelAuthMode,
  Scope,
  SessionStatus,
} from "@lindorm-io/common-enums";
import { baseHash } from "@lindorm-io/core";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { TEST_GET_USERINFO_RESPONSE } from "../../../fixtures/data";
import {
  createTestBackchannelSession,
  createTestClient,
  createTestTenant,
} from "../../../fixtures/entity";
import {
  TEST_BACKCHANNEL_SESSION_CACHE,
  TEST_CLIENT_REPOSITORY,
  TEST_TENANT_REPOSITORY,
  getTestClientCredentials,
  setupIntegration,
} from "../../../fixtures/integration";
import { configuration } from "../../../server/configuration";
import { server } from "../../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/admin/sessions/backchannel", () => {
  beforeAll(setupIntegration);

  nock("https://identity.test.lindorm.io")
    .get("/admin/claims")
    .query(true)
    .times(999)
    .reply(200, TEST_GET_USERINFO_RESPONSE);

  nock("https://test.client.lindorm.io")
    .get("/.well-known/jwks.json")
    .query(true)
    .times(999)
    .reply(200, {
      keys: [
        {
          alg: "RS512",
          e: "AQAB",
          key_ops: ["decrypt", "encrypt", "verify"],
          kid: "2d60172d-ac8a-4eaf-8ccd-873fc22dcb28",
          kty: "RSA",
          n: "yjql5hIlllH81iamrW5BtOjIc9TKD0+dMazmKhKq/waqKcYtgI06p4YmF940f3OW8dKKXRLBbvu++VBN6/RMP9JFpYg1r4U1UbqwDMFeRRFiMZgH86FW6KhhyECxkWm6/5NRdu7cEw5mNVi08i0MsxuvFWEvSTArBLP5Ctw9m3KNza/HRlO4oVPaiwtxadTlqyYsFr2cEwjZvAadrrj1tLiasCX/UcmBE5Csoo8hayUXdM9hofg2QBXYGKiRTCr5WnxIKfagmzhGdClmZw6C+/8QWogm3tREq52IX5DPwEjUJ0Lq2AZ2O7HMpMx0NwkwrDSysT6K+klphyrpe1WG0RvEzeSQ7jfRf5Xe997LPv5LB6nFz4HtOaVcM2sEGHqS9iPWByAX4Y+2zvQvbDQPAcpEVojPRWJeZLEYJUvIhEeZ5Q9pOobF0qKH3dxxZNSDCXkVSrne6au7sfSR7toqqnBSOTpWCluzw1SjYBKd6cP0tNgkjUEvJFb1QsAV3GNbppFch4LCc5/MSX07l1MdlZ44H8TYAA20VWmsYBW00EFRITe0bNIAxl5wos3NLduozOMZwWRXawDWUQqejeJjggM2QtO0yuRuvVFlhQqs5sHz8fsux7RIkE/gVDy51ai+hUQ4GL3o0ELSsLzfTzUhRvUqSW8/kAf5GZnygQgGrMs=",
          use: "enc",
        },
      ],
    });

  test("should resolve data", async () => {
    const tenant = await TEST_TENANT_REPOSITORY.create(createTestTenant());
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient({ tenantId: tenant.id }));

    const backchannelSession = await TEST_BACKCHANNEL_SESSION_CACHE.create(
      createTestBackchannelSession({
        clientId: client.id,
        requestedConsent: {
          audiences: ["0d51b830-1c22-4eea-95cf-209505626d63"],
          scopes: [Scope.OPENID, Scope.PHONE, Scope.PROFILE],
        },
        requestedLogin: {
          factors: [AuthenticationFactor.TWO_FACTOR],
          identityId: "3ff854d8-8a65-4c27-bd04-b15e47499980",
          levelOfAssurance: 4,
          methods: [AuthenticationMethod.EMAIL],
          minimumLevelOfAssurance: 2,
          strategies: [AuthenticationStrategy.PHONE_OTP],
        },
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const response = await request(server.callback())
      .get(`/admin/sessions/backchannel/${backchannelSession.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      consent: {
        is_required: true,
        status: "pending",

        audiences: ["0d51b830-1c22-4eea-95cf-209505626d63"],
        optional_scopes: ["phone", "profile"],
        required_scopes: ["offline_access", "openid"],
        scope_descriptions: [
          { name: "openid", description: "Give the client access to your OpenID claims." },
          { name: "profile", description: "Give the client access to your profile information." },
        ],
      },

      login: {
        is_required: true,
        status: "pending",

        factors: ["urn:lindorm:auth:acr:2fa"],
        identity_id: "3ff854d8-8a65-4c27-bd04-b15e47499980",
        level_of_assurance: 4,
        methods: ["urn:lindorm:auth:method:email"],
        minimum_level_of_assurance: 2,
        strategies: ["urn:lindorm:auth:strategy:phone-otp"],
      },

      backchannel_session: {
        id: backchannelSession.id,
        binding_message: "binding-message",
        client_notification_token: "client-notification.jwt.jwt",
        expires: "2021-01-02T08:00:00.000Z",
        id_token_hint: "id.jwt.jwt",
        login_hint_token: "login-hint.jwt.jwt",
        login_hint: "test@lindorm.io",
        requested_expiry: 3600,
        user_code: "user-code",
      },

      client: {
        id: client.id,
        name: "ClientName",
        logo_uri: "https://logo.uri/logo",
        single_sign_on: true,
        type: "confidential",
      },

      tenant: {
        id: tenant.id,
        name: "TenantName",
      },
    });
  });

  test("should confirm consent", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const backchannelSession = await TEST_BACKCHANNEL_SESSION_CACHE.create(
      createTestBackchannelSession({
        requestedConsent: {
          audiences: [client.id],
          scopes: Object.values(Scope),
        },
        clientId: client.id,
      }),
    );

    await request(server.callback())
      .post(`/admin/sessions/backchannel/${backchannelSession.id}/consent`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        audiences: backchannelSession.requestedConsent.audiences,
        scopes: backchannelSession.requestedConsent.scopes,
      })
      .expect(204);

    await expect(
      TEST_BACKCHANNEL_SESSION_CACHE.find({ id: backchannelSession.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        status: expect.objectContaining({
          consent: "confirmed",
        }),
      }),
    );
  });

  test("should confirm login", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const backchannelSession = await TEST_BACKCHANNEL_SESSION_CACHE.create(
      createTestBackchannelSession({
        clientId: client.id,
      }),
    );

    await request(server.callback())
      .post(`/admin/sessions/backchannel/${backchannelSession.id}/login`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        factors: [AuthenticationFactor.TWO_FACTOR],
        identity_id: randomUUID(),
        level_of_assurance: 2,
        metadata: { ip: "127.0.0.1" },
        methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.TIME_BASED_OTP],
        remember: true,
        singleSignOn: true,
        strategies: [AuthenticationStrategy.EMAIL_OTP, AuthenticationStrategy.TIME_BASED_OTP],
      })
      .expect(204);

    await expect(
      TEST_BACKCHANNEL_SESSION_CACHE.find({ id: backchannelSession.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        status: expect.objectContaining({
          login: "confirmed",
        }),
      }),
    );
  });

  test("should confirm login and ping client using notification token", async () => {
    const scope = nock("https://test.client.lindorm.io")
      .post("/backchannel-auth-callback")
      .matchHeader("Authorization", "Bearer client-notification.jwt.jwt")
      .times(1)
      .reply(204);

    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        backchannelAuth: {
          mode: OpenIdBackchannelAuthMode.PING,
          uri: "https://test.client.lindorm.io/backchannel-auth-callback",
          username: null,
          password: null,
        },
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const backchannelSession = await TEST_BACKCHANNEL_SESSION_CACHE.create(
      createTestBackchannelSession({
        clientId: client.id,
        confirmedConsent: {
          audiences: [client.id],
          scopes: Object.values(Scope),
        },
        status: {
          consent: SessionStatus.CONFIRMED,
          login: SessionStatus.PENDING,
        },
      }),
    );

    await request(server.callback())
      .post(`/admin/sessions/backchannel/${backchannelSession.id}/login`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        factors: [AuthenticationFactor.TWO_FACTOR],
        identity_id: randomUUID(),
        level_of_assurance: 2,
        metadata: { ip: "127.0.0.1" },
        methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.TIME_BASED_OTP],
        remember: true,
        singleSignOn: true,
        strategies: [AuthenticationStrategy.EMAIL_OTP, AuthenticationStrategy.TIME_BASED_OTP],
      })
      .expect(204);

    scope.done();
  });

  test("should confirm login and push to client using basic auth", async () => {
    const scope = nock("https://test.client.lindorm.io")
      .post("/backchannel-auth-callback")
      .matchHeader("Authorization", `Basic ${baseHash("username:password")}`)
      .times(1)
      .reply(204);

    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        backchannelAuth: {
          mode: OpenIdBackchannelAuthMode.PUSH,
          uri: "https://test.client.lindorm.io/backchannel-auth-callback",
          username: "username",
          password: "password",
        },
        customClaims: {
          uri: null,
          username: null,
          password: null,
        },
      }),
    );

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const backchannelSession = await TEST_BACKCHANNEL_SESSION_CACHE.create(
      createTestBackchannelSession({
        clientId: client.id,
        clientNotificationToken: null,
        confirmedConsent: {
          audiences: [client.id],
          scopes: Object.values(Scope),
        },
        status: {
          consent: SessionStatus.CONFIRMED,
          login: SessionStatus.PENDING,
        },
      }),
    );

    await request(server.callback())
      .post(`/admin/sessions/backchannel/${backchannelSession.id}/login`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        factors: [AuthenticationFactor.TWO_FACTOR],
        identity_id: randomUUID(),
        level_of_assurance: 2,
        metadata: { ip: "127.0.0.1" },
        methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.TIME_BASED_OTP],
        remember: true,
        singleSignOn: true,
        strategies: [AuthenticationStrategy.EMAIL_OTP, AuthenticationStrategy.TIME_BASED_OTP],
      })
      .expect(204);

    scope.done();
  });

  test("should reject", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());

    const clientCredentials = getTestClientCredentials({
      audiences: [configuration.oauth.client_id, client.id],
      subject: client.id,
    });

    const backchannelSession = await TEST_BACKCHANNEL_SESSION_CACHE.create(
      createTestBackchannelSession({ clientId: client.id }),
    );

    await request(server.callback())
      .post(`/admin/sessions/backchannel/${backchannelSession.id}/reject`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(204);

    await expect(
      TEST_BACKCHANNEL_SESSION_CACHE.find({ id: backchannelSession.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        status: expect.objectContaining({
          consent: "rejected",
          login: "rejected",
        }),
      }),
    );
  });
});
