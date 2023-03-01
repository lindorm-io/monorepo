import MockDate from "mockdate";
import request from "supertest";
import { IdentifierType } from "@lindorm-io/common-types";
import { randomNumber, randomString } from "@lindorm-io/random";
import { server } from "../../server/server";
import {
  createTestEmailIdentifier,
  createTestIdentity,
  createTestPhoneIdentifier,
} from "../../fixtures/entity";
import {
  getTestClientCredentials,
  setupIntegration,
  TEST_IDENTIFIER_REPOSITORY,
  TEST_IDENTITY_REPOSITORY,
} from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/admin/identifiers", () => {
  beforeAll(setupIntegration);

  test("POST /", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(createTestIdentity());

    const clientCredentials = getTestClientCredentials();

    await request(server.callback())
      .post(`/admin/identifiers`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        identity_id: identity.id,
        identifier: "0701234567",
        label: "mobile",
        type: IdentifierType.PHONE,
        verified: false,
      })
      .expect(204);

    await expect(
      TEST_IDENTIFIER_REPOSITORY.find({ identityId: identity.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        label: "mobile",
        type: IdentifierType.PHONE,
        value: "0701234567",
        verified: false,
      }),
    );
  });

  test("PATCH /:id", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      createTestIdentity({
        displayName: {
          name: randomString(10),
          number: randomNumber(4),
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
        label: "home",
        primary: false,
      }),
    );

    const clientCredentials = getTestClientCredentials();

    await request(server.callback())
      .patch(`/admin/identifiers/${phone.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        label: "work",
        primary: true,
      })
      .expect(204);

    await expect(TEST_IDENTIFIER_REPOSITORY.find({ id: phone.id })).resolves.toStrictEqual(
      expect.objectContaining({
        label: "work",
        primary: true,
      }),
    );
  });

  test("DELETE /:id", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      createTestIdentity({
        displayName: {
          name: randomString(10),
          number: randomNumber(4),
        },
      }),
    );

    const email = await TEST_IDENTIFIER_REPOSITORY.create(
      createTestEmailIdentifier({
        identityId: identity.id,
        primary: false,
      }),
    );

    const clientCredentials = getTestClientCredentials();

    await request(server.callback())
      .delete(`/admin/identifiers/${email.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(204);

    await expect(TEST_IDENTIFIER_REPOSITORY.tryFind({ id: email.id })).resolves.toBeUndefined();
  });
});
