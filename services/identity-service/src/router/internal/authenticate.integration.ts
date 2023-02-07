import MockDate from "mockdate";
import request from "supertest";
import { createTestEmailIdentifier, createTestIdentity } from "../../fixtures/entity";
import { randomNumber, randomString } from "@lindorm-io/random";
import { server } from "../../server/server";
import {
  TEST_IDENTIFIER_REPOSITORY,
  TEST_IDENTITY_REPOSITORY,
  getTestClientCredentials,
  setupIntegration,
} from "../../fixtures/integration";
import { IdentifierTypes } from "@lindorm-io/common-types";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/internal/authenticate", () => {
  beforeAll(setupIntegration);

  test("POST / - should create new identity", async () => {
    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .post("/internal/authenticate")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        identifier: `${randomString(16).toLowerCase()}@lindorm.io`,
        type: IdentifierTypes.EMAIL,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      identity_id: expect.any(String),
    });
  });

  test("POST / - should verify existing identity", async () => {
    const clientCredentials = getTestClientCredentials();

    const identity = await TEST_IDENTITY_REPOSITORY.create(createTestIdentity());

    const email = await TEST_IDENTIFIER_REPOSITORY.create(
      createTestEmailIdentifier({
        identityId: identity.id,
      }),
    );

    const response = await request(server.callback())
      .post("/internal/authenticate")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        identifier: email.identifier,
        identity_id: identity.id,
        type: email.type,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      identity_id: identity.id,
    });
  });

  test("POST / - should verify email", async () => {
    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .post("/internal/authenticate")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        identifier: `${randomString(16).toLowerCase()}@lindorm.io`,
        type: IdentifierTypes.EMAIL,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      identity_id: expect.any(String),
    });
  });

  test("POST / - should verify external", async () => {
    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .post("/internal/authenticate")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        identifier: randomString(32),
        provider: "https://login.apple.com/",
        type: IdentifierTypes.EXTERNAL,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      identity_id: expect.any(String),
    });
  });

  test("POST / - should verify phone", async () => {
    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .post("/internal/authenticate")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        identifier: `+4670${randomNumber(7)}`,
        type: IdentifierTypes.PHONE,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      identity_id: expect.any(String),
    });
  });

  test("POST / - should verify national identity number", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      createTestIdentity({
        nationalIdentityNumberVerified: false,
      }),
    );

    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .post("/internal/authenticate")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        identifier: identity.nationalIdentityNumber,
        type: IdentifierTypes.NIN,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      identity_id: identity.id,
    });
  });

  test("POST / - should verify username", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      createTestIdentity({
        username: randomString(12),
      }),
    );

    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .post("/internal/authenticate")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        identifier: identity.username,
        type: IdentifierTypes.USERNAME,
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      identity_id: identity.id,
    });
  });
});
