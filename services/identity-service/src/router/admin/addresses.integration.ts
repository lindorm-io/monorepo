import MockDate from "mockdate";
import request from "supertest";
import { server } from "../../server/server";
import { createTestAddress, createTestIdentity } from "../../fixtures/entity";
import {
  getTestClientCredentials,
  setupIntegration,
  TEST_ADDRESS_REPOSITORY,
  TEST_IDENTITY_REPOSITORY,
} from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/admin/addresses", () => {
  beforeAll(setupIntegration);

  test("POST /", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(createTestIdentity());

    const clientCredentials = getTestClientCredentials();

    await request(server.callback())
      .post(`/admin/addresses`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        identity_id: identity.id,
        care_of: "careOf",
        country: "country",
        label: "label",
        locality: "locality",
        postal_code: "postalCode",
        region: "region",
        street_address: ["streetAddress"],
      })
      .expect(204);

    await expect(TEST_ADDRESS_REPOSITORY.find({ identityId: identity.id })).resolves.toStrictEqual(
      expect.objectContaining({
        careOf: "careOf",
        country: "country",
        label: "label",
        locality: "locality",
        postalCode: "postalCode",
        region: "region",
        streetAddress: ["streetAddress"],
      }),
    );
  });

  test("PATCH /:id", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(createTestIdentity());
    const address = await TEST_ADDRESS_REPOSITORY.create(
      createTestAddress({ identityId: identity.id }),
    );

    const clientCredentials = getTestClientCredentials();

    await request(server.callback())
      .patch(`/admin/addresses/${address.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        care_of: "new-careOf",
        country: "new-country",
        label: "new-label",
        locality: "new-locality",
        postal_code: "new-postalCode",
        region: "new-region",
        street_address: ["new-streetAddress"],
      })
      .expect(204);

    await expect(TEST_ADDRESS_REPOSITORY.find({ id: address.id })).resolves.toStrictEqual(
      expect.objectContaining({
        careOf: "new-careOf",
        country: "new-country",
        label: "new-label",
        locality: "new-locality",
        postalCode: "new-postalCode",
        region: "new-region",
        streetAddress: ["new-streetAddress"],
      }),
    );
  });

  test("DELETE /:id", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(createTestIdentity());
    const address = await TEST_ADDRESS_REPOSITORY.create(
      createTestAddress({ identityId: identity.id, primary: false }),
    );

    const clientCredentials = getTestClientCredentials();

    await request(server.callback())
      .delete(`/admin/addresses/${address.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(204);
  });
});
