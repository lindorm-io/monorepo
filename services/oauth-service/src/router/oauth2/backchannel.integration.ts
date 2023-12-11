import {
  AuthenticationFactor,
  AuthenticationLevel,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";
import { baseHash } from "@lindorm-io/core";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { createTestClient, createTestTenant } from "../../fixtures/entity";
import {
  TEST_ARGON,
  TEST_BACKCHANNEL_SESSION_CACHE,
  TEST_CLIENT_REPOSITORY,
  TEST_TENANT_REPOSITORY,
  getTestIdToken,
  setupIntegration,
} from "../../fixtures/integration";
import { configuration } from "../../server/configuration";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/oauth2/backchannel", () => {
  beforeAll(setupIntegration);

  nock("https://authentication.test.lindorm.io")
    .get("/admin/grant-types/backchannel-auth")
    .query(true)
    .times(1)
    .reply(204);

  test("should resolve", async () => {
    const tenant = await TEST_TENANT_REPOSITORY.create(createTestTenant());
    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        secret: await TEST_ARGON.sign("secret"),
        tenantId: tenant.id,
      }),
    );

    const identityId = randomUUID();
    const idToken = getTestIdToken({
      audiences: [configuration.oauth.client_id, client.id],
      claims: {
        email: "email@lindorm.io",
        phoneNumber: "+46705498721",
        username: "identity_username",
      },
      subject: identityId,
    });

    const response = await request(server.callback())
      .post("/oauth2/backchannel")
      .set("Authorization", `Basic ${baseHash(`${client.id}:secret`)}`)
      .send({
        acr_values: [
          AuthenticationLevel.LOA_3,
          AuthenticationFactor.TWO_FACTOR,
          AuthenticationMethod.SESSION_LINK,
          AuthenticationMethod.PHONE,
          AuthenticationStrategy.EMAIL_CODE,
        ].join(" "),
        binding_message: "binding_message",
        client_notification_token: "client_notification_token",
        id_token_hint: idToken,
        login_hint_token: "login_hint_token",
        login_hint: "test@lindorm.io",
        requested_expiry: 3600,
        scope: ["address", "email", "offline_access", "openid", "phone", "profile"].join(" "),
        user_code: "user_code",
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      auth_req_id: expect.any(String),
      expires_in: 1800,
      interval: 500,
    });

    await expect(
      TEST_BACKCHANNEL_SESSION_CACHE.find({ id: response.body.auth_req_id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        bindingMessage: "binding_message",
        clientId: client.id,
        clientNotificationToken: "client_notification_token",
        confirmedConsent: {
          audiences: [],
          scopes: [],
        },
        confirmedLogin: {
          factors: [],
          identityId: null,
          latestAuthentication: null,
          levelOfAssurance: 0,
          metadata: {},
          methods: [],
          remember: false,
          singleSignOn: false,
          strategies: [],
        },
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: expect.any(String),
        loginHint: "test@lindorm.io",
        loginHintToken: "login_hint_token",
        requestedConsent: {
          audiences: expect.arrayContaining([configuration.oauth.client_id, client.id]),
          scopes: ["address", "email", "offline_access", "openid", "phone", "profile"],
        },
        requestedLogin: {
          factors: ["urn:lindorm:auth:acr:2fa"],
          identityId: identityId,
          levelOfAssurance: 3,
          methods: ["urn:lindorm:auth:method:session-link", "urn:lindorm:auth:method:phone"],
          minimumLevelOfAssurance: 3,
          strategies: ["urn:lindorm:auth:strategy:email-code"],
        },
        requestedExpiry: 3600,
        status: {
          consent: "pending",
          login: "pending",
        },
        userCode: "user_code",
      }),
    );
  });
});
