import MockDate from "mockdate";
import request from "supertest";
import { CryptoAES } from "@lindorm-io/crypto";
import { ProtectedRecord } from "../entity";
import { randomUUID } from "crypto";
import { server } from "../server/server";
import { stringifyBlob } from "@lindorm-io/string-blob";
import {
  getTestClientCredentials,
  setupIntegration,
  TEST_PROTECTED_RECORD_REPOSITORY,
} from "../test/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/vault", () => {
  beforeAll(setupIntegration);

  test("POST /vault", async () => {
    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .post("/vault")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        id: randomUUID(),
        data: { foo: "bar", baz: "qok" },
        expires: "2023-01-01T08:00:00.000+03:00",
      })
      .expect(201);

    expect(response.body).toStrictEqual({
      key: expect.any(String),
    });
  });

  test("POST /vault/:id/unlock", async () => {
    const clientCredentials = getTestClientCredentials();

    const key = "secret";
    const crypto = new CryptoAES({ secret: key });
    const entity = await TEST_PROTECTED_RECORD_REPOSITORY.create(
      new ProtectedRecord({
        protectedData: crypto.encrypt(stringifyBlob({ foo: "bar", baz: "qok" })),
        expires: new Date("2024-02-03T09:10:15.000Z"),
        owner: "08e99132-09d5-4f87-a489-a62d2896a7bf",
        ownerType: "client",
      }),
    );

    const response = await request(server.callback())
      .post(`/vault/${entity.id}/unlock`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({ key })
      .expect(200);

    expect(response.body).toStrictEqual({
      data: { foo: "bar", baz: "qok" },
      expires: "2024-02-03T09:10:15.000Z",
    });
  });

  test("DELETE /vault/:id", async () => {
    const clientCredentials = getTestClientCredentials();

    const entity = await TEST_PROTECTED_RECORD_REPOSITORY.create(
      new ProtectedRecord({
        protectedData: "encrypted-data",
        expires: null,
        owner: "08e99132-09d5-4f87-a489-a62d2896a7bf",
        ownerType: "client",
      }),
    );

    await request(server.callback())
      .delete(`/vault/${entity.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(204);
  });
});
