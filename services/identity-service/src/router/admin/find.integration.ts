import MockDate from "mockdate";
import request from "supertest";
import { server } from "../../server/server";
import {
  createTestEmailIdentifier,
  createTestExternalIdentifier,
  createTestIdentity,
  createTestNinIdentifier,
  createTestPhoneIdentifier,
  createTestSsnIdentifier,
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

describe("/admin/find", () => {
  beforeAll(setupIntegration);

  test("GET /?email", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(createTestIdentity());
    const identifier = await TEST_IDENTIFIER_REPOSITORY.create(
      createTestEmailIdentifier({ identityId: identity.id }),
    );

    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .get(`/admin/find`)
      .query({
        email: identifier.value,
      })
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({ identity_id: identity.id });
  });

  test("GET /?external", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(createTestIdentity());
    const identifier = await TEST_IDENTIFIER_REPOSITORY.create(
      createTestExternalIdentifier({ identityId: identity.id }),
    );

    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .get(`/admin/find`)
      .query({
        external: identifier.value,
        provider: identifier.provider,
      })
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({ identity_id: identity.id });
  });

  test("GET /?phone", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(createTestIdentity());
    const identifier = await TEST_IDENTIFIER_REPOSITORY.create(
      createTestPhoneIdentifier({ identityId: identity.id }),
    );

    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .get(`/admin/find`)
      .query({
        phone: identifier.value,
      })
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({ identity_id: identity.id });
  });

  test("GET /?nin", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(createTestIdentity());
    const identifier = await TEST_IDENTIFIER_REPOSITORY.create(
      createTestNinIdentifier({ identityId: identity.id }),
    );

    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .get(`/admin/find`)
      .query({
        nin: identifier.value,
      })
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({ identity_id: identity.id });
  });

  test("GET /?ssn", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(createTestIdentity());
    const identifier = await TEST_IDENTIFIER_REPOSITORY.create(
      createTestSsnIdentifier({ identityId: identity.id }),
    );

    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .get(`/admin/find`)
      .query({
        ssn: identifier.value,
      })
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({ identity_id: identity.id });
  });

  test("GET /?username", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(createTestIdentity());

    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .get(`/admin/find`)
      .query({
        username: identity.username,
      })
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({ identity_id: identity.id });
  });
});
