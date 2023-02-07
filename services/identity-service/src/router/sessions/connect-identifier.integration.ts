import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { argon } from "../../instance";
import { randomNumber, randomString } from "@lindorm-io/random";
import { server } from "../../server/server";
import {
  TEST_CONNECT_SESSION_CACHE,
  TEST_IDENTIFIER_REPOSITORY,
  TEST_IDENTITY_REPOSITORY,
  getTestAccessToken,
  setupIntegration,
} from "../../fixtures/integration";
import {
  createTestConnectSession,
  createTestIdentity,
  createTestPhoneIdentifier,
} from "../../fixtures/entity";
import { IdentifierTypes } from "@lindorm-io/common-types";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/sessions/connect-identifier", () => {
  beforeAll(setupIntegration);

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      access_token: "accessToken",
      expires_in: 100,
      scope: ["scope"],
    });

  nock("https://communication.test.lindorm.io")
    .post("/internal/send/code")
    .times(999)
    .reply(200, {});

  test("POST /", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      createTestIdentity({
        displayName: {
          name: randomString(10),
          number: randomNumber(4),
        },
      }),
    );

    const accessToken = getTestAccessToken({
      subject: identity.id,
    });

    await request(server.callback())
      .post("/sessions/connect-identifier")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        identifier: `${randomString(16).toLowerCase()}@lindorm.io`,
        label: "label",
        type: IdentifierTypes.EMAIL,
      })
      .expect(204);
  });

  test("POST /:id/verify", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      createTestIdentity({
        displayName: {
          name: randomString(10),
          number: randomNumber(4),
        },
      }),
    );

    const phone = await TEST_IDENTIFIER_REPOSITORY.create(
      createTestPhoneIdentifier({
        identityId: identity.id,
        verified: false,
      }),
    );

    const code = randomString(64);
    const connectSession = await TEST_CONNECT_SESSION_CACHE.create(
      createTestConnectSession({
        code: await argon.encrypt(code),
        identifierId: phone.id,
      }),
    );

    await request(server.callback())
      .post(`/sessions/connect-identifier/${connectSession.id}/verify`)
      .send({
        code,
      })
      .expect(204);
  });
});
