import { RsaKeySet } from "@lindorm-io/jwk";
import MockDate from "mockdate";
import request from "supertest";
import { createTestClient, createTestPublicKey } from "../../fixtures/entity";
import {
  TEST_CLIENT_REPOSITORY,
  TEST_PUBLIC_KEY_REPOSITORY,
  getTestClientCredentials,
  setupIntegration,
} from "../../fixtures/integration";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/admin/clients", () => {
  beforeAll(setupIntegration);

  test("should create client", async () => {
    const clientCredentials = getTestClientCredentials();

    const keySet = await RsaKeySet.generate(2);

    const response = await request(server.callback())
      .post("/admin/clients")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        id: "49e2e951-1910-4c35-a4bc-a77a80d502d2",
        name: "test-client-name",
        public_key: keySet.export("pem").publicKey,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      public_key_id: expect.any(String),
    });
  });

  test("should get client", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());

    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .get(`/admin/clients/${client.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      active: true,
      name: "Test Client Name",
      public_key_id: expect.any(String),
    });
  });

  test("should update client", async () => {
    const client = await TEST_CLIENT_REPOSITORY.create(createTestClient());

    const clientCredentials = getTestClientCredentials();

    await request(server.callback())
      .patch(`/admin/clients/${client.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        active: false,
        name: "New Test Client Name",
      })
      .expect(204);

    await expect(TEST_CLIENT_REPOSITORY.find({ id: client.id })).resolves.toStrictEqual(
      expect.objectContaining({
        active: false,
        name: "New Test Client Name",
      }),
    );
  });

  test("should update client public key", async () => {
    const publicKey = await TEST_PUBLIC_KEY_REPOSITORY.create(createTestPublicKey());

    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        publicKeyId: publicKey.id,
      }),
    );

    const clientCredentials = getTestClientCredentials();

    const keySet = await RsaKeySet.generate(2);
    const pem = keySet.export("pem");

    const response = await request(server.callback())
      .put(`/admin/clients/${client.id}/public-key`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        public_key: pem.publicKey,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      public_key_id: expect.any(String),
    });

    const key = await TEST_PUBLIC_KEY_REPOSITORY.find({ id: response.body.public_key_id });

    expect(key.keySet.export("pem").publicKey).toBe(pem.publicKey);

    await expect(TEST_PUBLIC_KEY_REPOSITORY.tryFind({ id: publicKey.id })).resolves.toBeUndefined();
  });

  test("should destroy client and public key", async () => {
    const publicKey = await TEST_PUBLIC_KEY_REPOSITORY.create(createTestPublicKey());

    const client = await TEST_CLIENT_REPOSITORY.create(
      createTestClient({
        publicKeyId: publicKey.id,
      }),
    );

    const clientCredentials = getTestClientCredentials();

    await request(server.callback())
      .delete(`/admin/clients/${client.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(204);

    await expect(TEST_CLIENT_REPOSITORY.tryFind({ id: client.id })).resolves.toBeUndefined();
    await expect(TEST_PUBLIC_KEY_REPOSITORY.tryFind({ id: publicKey.id })).resolves.toBeUndefined();
  });
});
