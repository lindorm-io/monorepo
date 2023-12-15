import { AesCipher } from "@lindorm-io/aes";
import { stringifyBlob } from "@lindorm-io/string-blob";
import { randomBytes, randomUUID } from "crypto";
import MockDate from "mockdate";
import request from "supertest";
import { EncryptedRecord, EncryptionKey } from "../../entity";
import {
  TEST_ENCRYPTED_RECORD_REPOSITORY,
  TEST_ENCRYPTION_KEY_REPOSITORY,
  getTestClientCredentials,
  setupIntegration,
} from "../../fixtures/integration";
import { aesCipher } from "../../instance";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/internal/vault", () => {
  beforeAll(setupIntegration);

  test("POST /internal/vault", async () => {
    const subject = randomUUID();
    const clientCredentials = getTestClientCredentials({ subject });

    await request(server.callback())
      .post("/internal/vault")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        id: randomUUID(),
        data: { foo: "bar", baz: "qok" },
        expires: "2023-01-01T08:00:00.000+03:00",
      })
      .expect(201);
  });

  test("GET /internal/vault/:id", async () => {
    const subject = randomUUID();
    const clientCredentials = getTestClientCredentials({ subject });

    const encryptionKey = await TEST_ENCRYPTION_KEY_REPOSITORY.create(
      new EncryptionKey({
        key: aesCipher.encrypt(randomBytes(16).toString("hex")),
        owner: subject,
        ownerType: "client",
      }),
    );
    const secret = aesCipher.decrypt(encryptionKey.key);
    const testCipher = new AesCipher({ secret });

    const entity = await TEST_ENCRYPTED_RECORD_REPOSITORY.create(
      new EncryptedRecord({
        encryptedData: testCipher.encrypt(stringifyBlob({ foo: "bar", baz: "qok" })),
        expires: new Date("2024-02-03T09:10:15.000Z"),
      }),
    );

    const response = await request(server.callback())
      .get(`/internal/vault/${entity.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      data: { foo: "bar", baz: "qok" },
      expires: "2024-02-03T09:10:15.000Z",
    });
  });

  test("DELETE /internal/vault/:id", async () => {
    const subject = randomUUID();
    const clientCredentials = getTestClientCredentials({ subject });

    const encryptionKey = await TEST_ENCRYPTION_KEY_REPOSITORY.create(
      new EncryptionKey({
        key: aesCipher.encrypt(randomBytes(16).toString("hex")),
        owner: subject,
        ownerType: "client",
      }),
    );
    const secret = aesCipher.decrypt(encryptionKey.key);
    const testCipher = new AesCipher({ secret });

    const entity = await TEST_ENCRYPTED_RECORD_REPOSITORY.create(
      new EncryptedRecord({
        encryptedData: testCipher.encrypt(stringifyBlob({ foo: "bar", baz: "qok" })),
        expires: new Date("2024-02-03T09:10:15.000Z"),
      }),
    );

    await request(server.callback())
      .delete(`/internal/vault/${entity.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(204);
  });
});
