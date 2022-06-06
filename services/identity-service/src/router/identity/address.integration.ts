import MockDate from "mockdate";
import request from "supertest";
import { createTestAddress, createTestIdentity } from "../../fixtures/entity";
import { server } from "../../server/server";
import {
  getTestAccessToken,
  setupIntegration,
  TEST_ADDRESS_REPOSITORY,
  TEST_IDENTITY_REPOSITORY,
} from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/identity/address", () => {
  beforeAll(setupIntegration);

  test("POST /", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(createTestIdentity());

    const accessToken = getTestAccessToken({
      subject: identity.id,
    });

    const response = await request(server.callback())
      .post("/identity/address")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        care_of: "careOf",
        country: "country",
        label: "label",
        locality: "locality",
        postal_code: "postalCode",
        region: "region",
        street_address: ["streetAddress"],
      })
      .expect(201);

    expect(response.body).toStrictEqual({
      address_id: expect.any(String),
    });
  });

  test("PATCH /:id", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(createTestIdentity());

    const address = await TEST_ADDRESS_REPOSITORY.create(
      createTestAddress({
        identityId: identity.id,
      }),
    );

    const accessToken = getTestAccessToken({
      subject: identity.id,
    });

    await request(server.callback())
      .patch(`/identity/address/${address.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        care_of: "careOf",
        country: "country",
        label: "label",
        locality: "locality",
        postal_code: "postalCode",
        region: "region",
        street_address: ["streetAddress"],
      })
      .expect(204);
  });

  test("DELETE /:id", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(createTestIdentity());

    const address = await TEST_ADDRESS_REPOSITORY.create(
      createTestAddress({
        identityId: identity.id,
        primary: false,
      }),
    );

    const accessToken = getTestAccessToken({
      subject: identity.id,
    });

    await request(server.callback())
      .delete(`/identity/address/${address.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(204);
  });
});
