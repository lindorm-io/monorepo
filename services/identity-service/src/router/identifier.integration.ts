import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { IdentifierType } from "../common";
import { argon } from "../instance";
import { getRandomNumber, getRandomString } from "@lindorm-io/core";
import { server } from "../server/server";
import {
  getTestAccessToken,
  setupIntegration,
  TEST_CONNECT_SESSION_CACHE,
  TEST_IDENTIFIER_REPOSITORY,
  TEST_IDENTITY_REPOSITORY,
} from "../fixtures/integration";
import {
  createTestConnectSession,
  createTestEmailIdentifier,
  createTestIdentity,
  createTestPhoneIdentifier,
} from "../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/identity", () => {
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

  test("DELETE /", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      createTestIdentity({
        displayName: {
          name: getRandomString(10),
          number: getRandomNumber(4),
        },
      }),
    );

    const email = await TEST_IDENTIFIER_REPOSITORY.create(
      createTestEmailIdentifier({
        identityId: identity.id,
      }),
    );

    const accessToken = getTestAccessToken({
      subject: identity.id,
    });

    await request(server.callback())
      .delete("/identifier")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        identifier: email.identifier,
        type: email.type,
      })
      .expect(204);
  });

  test("POST /connect", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      createTestIdentity({
        displayName: {
          name: getRandomString(10),
          number: getRandomNumber(4),
        },
      }),
    );

    const accessToken = getTestAccessToken({
      subject: identity.id,
    });

    await request(server.callback())
      .post("/identifier/connect")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        identifier: `${getRandomString(16).toLowerCase()}@lindorm.io`,
        label: "label",
        type: IdentifierType.EMAIL,
      })
      .expect(204);
  });

  test("POST /connect/:id/verify", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      createTestIdentity({
        displayName: {
          name: getRandomString(10),
          number: getRandomNumber(4),
        },
      }),
    );

    const phone = await TEST_IDENTIFIER_REPOSITORY.create(
      createTestPhoneIdentifier({
        identityId: identity.id,
        verified: false,
      }),
    );

    const code = getRandomString(64);
    const connectSession = await TEST_CONNECT_SESSION_CACHE.create(
      createTestConnectSession({
        code: await argon.encrypt(code),
        identifierId: phone.id,
      }),
    );

    await request(server.callback())
      .post(`/identifier/connect/${connectSession.id}/verify`)
      .send({
        code,
      })
      .expect(204);
  });

  test("POST /set-label", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      createTestIdentity({
        displayName: {
          name: getRandomString(10),
          number: getRandomNumber(4),
        },
      }),
    );

    const phone = await TEST_IDENTIFIER_REPOSITORY.create(
      createTestPhoneIdentifier({
        identityId: identity.id,
        label: "home",
        primary: false,
      }),
    );

    const accessToken = getTestAccessToken({
      subject: identity.id,
    });

    await request(server.callback())
      .post("/identifier/set-label")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        identifier: phone.identifier,
        label: "work",
        type: phone.type,
      })
      .expect(204);
  });

  test("POST /set-primary", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      createTestIdentity({
        displayName: {
          name: getRandomString(10),
          number: getRandomNumber(4),
        },
      }),
    );

    await TEST_IDENTIFIER_REPOSITORY.create(
      createTestPhoneIdentifier({
        identityId: identity.id,
        primary: true,
      }),
    );

    const phone = await TEST_IDENTIFIER_REPOSITORY.create(
      createTestPhoneIdentifier({
        identityId: identity.id,
        primary: false,
      }),
    );

    const accessToken = getTestAccessToken({
      subject: identity.id,
    });

    await request(server.callback())
      .post("/identifier/set-primary")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        identifier: phone.identifier,
        type: phone.type,
      })
      .expect(204);
  });
});
