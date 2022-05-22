import MockDate from "mockdate";
import request from "supertest";
import { CryptoAES } from "@lindorm-io/crypto";
import { EncryptedRecord } from "../../entity";
import { randomUUID } from "crypto";
import { server } from "../../server/server";
import { stringifyBlob } from "@lindorm-io/string-blob";
import {
  getTestClientCredentials,
  setupIntegration,
  TEST_ENCRYPTED_RECORD_REPOSITORY,
} from "../../test/integration";
import { baseHash } from "@lindorm-io/core";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

const getKey = (subjectHint: string, subject: string) => baseHash(`${subjectHint}:${subject}`);

describe("/internal/vault", () => {
  beforeAll(setupIntegration);

  test("POST /internal/vault", async () => {
    const clientCredentials = getTestClientCredentials();

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
    const clientCredentials = getTestClientCredentials();

    const secret = getKey("client", "08e99132-09d5-4f87-a489-a62d2896a7bf");
    const crypto = new CryptoAES({ secret });
    const entity = await TEST_ENCRYPTED_RECORD_REPOSITORY.create(
      new EncryptedRecord({
        encryptedData: crypto.encrypt(stringifyBlob({ foo: "bar", baz: "qok" })),
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
    const clientCredentials = getTestClientCredentials();

    const secret = getKey("client", "08e99132-09d5-4f87-a489-a62d2896a7bf");
    const crypto = new CryptoAES({ secret });
    const entity = await TEST_ENCRYPTED_RECORD_REPOSITORY.create(
      new EncryptedRecord({
        encryptedData: crypto.encrypt(stringifyBlob({ foo: "bar", baz: "qok" })),
        expires: new Date("2024-02-03T09:10:15.000Z"),
      }),
    );

    await request(server.callback())
      .delete(`/internal/vault/${entity.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(204);
  });
});
