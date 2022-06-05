import MockDate from "mockdate";
import request from "supertest";
import { Email, Identity, ExternalIdentifier, PhoneNumber } from "../../entity";
import { server } from "../../server/server";
import {
  createTestEmail,
  createTestIdentity,
  getTestExternalIdentifier,
  createTestPhoneNumber,
} from "../../fixtures/entity";
import {
  TEST_EMAIL_REPOSITORY,
  TEST_IDENTITY_REPOSITORY,
  TEST_EXTERNAL_IDENTIFIER_REPOSITORY,
  TEST_PHONE_NUMBER_REPOSITORY,
  getTestClientCredentials,
  setupIntegration,
} from "../../fixtures/integration";
import { IdentifierType } from "../../common";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/internal/identifiers", () => {
  let email: Email;
  let external: ExternalIdentifier;
  let identity: Identity;
  let phone: PhoneNumber;

  beforeAll(async () => {
    await setupIntegration();

    identity = await TEST_IDENTITY_REPOSITORY.create(createTestIdentity());
    email = await TEST_EMAIL_REPOSITORY.create(
      createTestEmail({
        identityId: identity.id,
      }),
    );
    external = await TEST_EXTERNAL_IDENTIFIER_REPOSITORY.create(
      getTestExternalIdentifier({
        identityId: identity.id,
      }),
    );
    phone = await TEST_PHONE_NUMBER_REPOSITORY.create(
      createTestPhoneNumber({
        identityId: identity.id,
      }),
    );
  });

  test("POST /authenticate", async () => {
    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .post("/internal/identifiers/authenticate")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        identifier: email.email,
        type: IdentifierType.EMAIL,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      identity_id: identity.id,
    });
  });

  test("POST /authenticate", async () => {
    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .post("/internal/identifiers/authenticate")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        identifier: phone.phoneNumber,
        type: IdentifierType.PHONE,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      identity_id: identity.id,
    });
  });

  test("POST /authenticate", async () => {
    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .post("/internal/identifiers/authenticate")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        identifier: external.identifier,
        provider: "https://login.apple.com/",
        type: IdentifierType.EXTERNAL,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      identity_id: identity.id,
    });
  });

  test("POST /authenticate", async () => {
    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .post("/internal/identifiers/authenticate")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        identifier: identity.username,
        type: IdentifierType.USERNAME,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      identity_id: identity.id,
    });
  });
});
