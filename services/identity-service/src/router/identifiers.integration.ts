import MockDate from "mockdate";
import request from "supertest";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { randomNumber, randomString } from "@lindorm-io/core";
import { server } from "../server/server";
import {
  getTestAccessToken,
  setupIntegration,
  TEST_IDENTIFIER_REPOSITORY,
  TEST_IDENTITY_REPOSITORY,
} from "../fixtures/integration";
import {
  createTestEmailIdentifier,
  createTestIdentity,
  createTestPhoneIdentifier,
} from "../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/identity", () => {
  beforeAll(setupIntegration);

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

    const accessToken = getTestAccessToken({
      subject: identity.id,
    });

    await request(server.callback())
      .patch(`/identifiers/${phone.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
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

    const accessToken = getTestAccessToken({
      subject: identity.id,
    });

    await request(server.callback())
      .delete(`/identifiers/${email.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);

    await expect(TEST_IDENTIFIER_REPOSITORY.find({ id: email.id })).rejects.toThrow(
      EntityNotFoundError,
    );
  });
});
