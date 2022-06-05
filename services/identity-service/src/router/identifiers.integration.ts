import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { ConnectSession, Email } from "../entity";
import { IdentifierType } from "../common";
import { createTestConnectSession, createTestEmail, createTestIdentity } from "../fixtures/entity";
import { randomUUID } from "crypto";
import { server } from "../server/server";
import {
  TEST_CONNECT_SESSION_CACHE,
  TEST_EMAIL_REPOSITORY,
  setupIntegration,
  TEST_IDENTITY_REPOSITORY,
  getTestAccessToken,
} from "../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/identifiers", () => {
  beforeAll(setupIntegration);

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      accessToken: "accessToken",
      expiresIn: 100,
      scope: ["scope"],
    });

  nock("https://communication.test.lindorm.io")
    .post("/internal/send/email")
    .times(999)
    .reply(200, {});

  nock("https://communication.test.lindorm.io")
    .post("/internal/send/sms")
    .times(999)
    .reply(200, {});

  test("POST /connect", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      createTestIdentity({
        id: randomUUID(),
      }),
    );

    const accessToken = getTestAccessToken({
      subject: identity.id,
    });

    await request(server.callback())
      .post(`/identifiers/connect`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        identifier: "new-identity-email@lindorm.io",
        type: IdentifierType.EMAIL,
      })
      .expect(200);

    await expect(
      TEST_EMAIL_REPOSITORY.find({ email: "new-identity-email@lindorm.io" }),
    ).resolves.toStrictEqual(expect.any(Email));

    await expect(TEST_CONNECT_SESSION_CACHE.findMany({})).resolves.toStrictEqual(
      expect.arrayContaining([expect.any(ConnectSession)]),
    );
  });

  test("POST /connect/:id/verify", async () => {
    const email = await TEST_EMAIL_REPOSITORY.create(
      createTestEmail({
        verified: false,
      }),
    );
    const session = await TEST_CONNECT_SESSION_CACHE.create(
      await createTestConnectSession({
        identifier: email.email,
        identityId: email.identityId,
      }),
    );

    const accessToken = getTestAccessToken({
      subject: email.identityId,
    });

    await request(server.callback())
      .post(`/identifiers/connect/${session.id}/verify`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        code: "secret",
      })
      .expect(204);
  });
});
