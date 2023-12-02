import { CryptoAes } from "@lindorm-io/crypto";
import { stringifyBlob } from "@lindorm-io/string-blob";
import { randomBytes, randomUUID } from "crypto";
import MockDate from "mockdate";
import request from "supertest";
import { ProtectedRecord } from "../entity";
import {
  TEST_PROTECTED_RECORD_REPOSITORY,
  getTestClientCredentials,
  setupIntegration,
} from "../fixtures/integration";
import { server } from "../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/vault", () => {
  beforeAll(setupIntegration);

  test("POST /vault", async () => {
    const subject = randomUUID();
    const clientCredentials = getTestClientCredentials({ subject });

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
    const subject = randomUUID();
    const clientCredentials = getTestClientCredentials({ subject });

    const key = randomBytes(16).toString("hex");
    const crypto = new CryptoAes({ secret: key });
    const entity = await TEST_PROTECTED_RECORD_REPOSITORY.create(
      new ProtectedRecord({
        protectedData: crypto.encrypt(stringifyBlob({ foo: "bar", baz: "qok" })),
        expires: new Date("2024-02-03T09:10:15.000Z"),
        owner: subject,
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
    const subject = randomUUID();
    const clientCredentials = getTestClientCredentials({ subject });

    const key = randomBytes(16).toString("hex");
    const crypto = new CryptoAes({ secret: key });
    const entity = await TEST_PROTECTED_RECORD_REPOSITORY.create(
      new ProtectedRecord({
        protectedData: crypto.encrypt(stringifyBlob({ foo: "bar", baz: "qok" })),
        expires: new Date("2024-02-03T09:10:15.000Z"),
        owner: subject,
        ownerType: "client",
      }),
    );

    await request(server.callback())
      .delete(`/vault/${entity.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({ key })
      .expect(204);
  });
});
