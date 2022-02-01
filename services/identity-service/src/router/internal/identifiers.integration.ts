import MockDate from "mockdate";
import request from "supertest";
import { Email, Identity, ExternalIdentifier, PhoneNumber } from "../../entity";
import { koa } from "../../server/koa";
import {
  getTestEmail,
  getTestIdentity,
  getTestExternalIdentifier,
  getTestPhoneNumber,
} from "../../test/entity";
import {
  TEST_EMAIL_REPOSITORY,
  TEST_IDENTITY_REPOSITORY,
  TEST_EXTERNAL_IDENTIFIER_REPOSITORY,
  TEST_PHONE_NUMBER_REPOSITORY,
  getTestClientCredentials,
  setupIntegration,
} from "../../test/integration";
import { IdentifierType } from "../../common";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("/internal/identifiers", () => {
  let email: Email;
  let external: ExternalIdentifier;
  let identity: Identity;
  let phone: PhoneNumber;

  beforeAll(async () => {
    await setupIntegration();

    identity = await TEST_IDENTITY_REPOSITORY.create(getTestIdentity());
    email = await TEST_EMAIL_REPOSITORY.create(
      getTestEmail({
        identityId: identity.id,
      }),
    );
    external = await TEST_EXTERNAL_IDENTIFIER_REPOSITORY.create(
      getTestExternalIdentifier({
        identityId: identity.id,
      }),
    );
    phone = await TEST_PHONE_NUMBER_REPOSITORY.create(
      getTestPhoneNumber({
        identityId: identity.id,
      }),
    );
  });

  test("POST /verify", async () => {
    const clientCredentials = getTestClientCredentials();

    const response = await request(koa.callback())
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

  test("POST /verify", async () => {
    const clientCredentials = getTestClientCredentials();

    const response = await request(koa.callback())
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

  test("POST /verify", async () => {
    const clientCredentials = getTestClientCredentials();

    const response = await request(koa.callback())
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

  test("POST /verify", async () => {
    const clientCredentials = getTestClientCredentials();

    const response = await request(koa.callback())
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
