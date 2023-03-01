import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { randomNumber, randomString } from "@lindorm-io/random";
import { server } from "../../server/server";
import {
  createTestAddress,
  createTestEmailIdentifier,
  createTestIdentity,
  createTestNinIdentifier,
  createTestPhoneIdentifier,
  createTestSsnIdentifier,
} from "../../fixtures/entity";
import {
  getTestClientCredentials,
  setupIntegration,
  TEST_ADDRESS_REPOSITORY,
  TEST_IDENTIFIER_REPOSITORY,
  TEST_IDENTITY_REPOSITORY,
} from "../../fixtures/integration";
import { LindormScope, OpenIdScope } from "@lindorm-io/common-types";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/admin/claims", () => {
  beforeAll(setupIntegration);

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      access_token: "accessToken",
      expires_in: 100,
      scope: ["scope"],
    });

  nock("https://oauth.test.lindorm.io")
    .get("/admin/sessions/claims/37c81a2f-88d3-4af9-a1c1-8636e2ab0435")
    .times(999)
    .reply(200, {
      identity_id: "e13c1038-ed23-44f9-ad7e-e8c91c523ae1",
      scopes: [...Object.values(OpenIdScope), ...Object.values(LindormScope)],
    });

  test("GET /", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      createTestIdentity({
        id: "e13c1038-ed23-44f9-ad7e-e8c91c523ae1",
        displayName: {
          name: randomString(12),
          number: randomNumber(4),
        },
      }),
    );

    await TEST_ADDRESS_REPOSITORY.create(
      createTestAddress({
        identityId: identity.id,
      }),
    );

    const email = await TEST_IDENTIFIER_REPOSITORY.create(
      createTestEmailIdentifier({
        identityId: identity.id,
      }),
    );

    const phone = await TEST_IDENTIFIER_REPOSITORY.create(
      createTestPhoneIdentifier({
        identityId: identity.id,
        verified: false,
      }),
    );

    const nin = await TEST_IDENTIFIER_REPOSITORY.create(
      createTestNinIdentifier({
        identityId: identity.id,
        verified: true,
      }),
    );

    const ssn = await TEST_IDENTIFIER_REPOSITORY.create(
      createTestSsnIdentifier({
        identityId: identity.id,
        verified: false,
      }),
    );

    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .get("/admin/claims")
      .set("Authorization", `Bearer ${clientCredentials}`)
      .query({
        session: "37c81a2f-88d3-4af9-a1c1-8636e2ab0435",
      })
      .expect(200);

    expect(response.body).toStrictEqual({
      active: true,
      address: {
        care_of: "Gustav Torsson",
        country: "Sweden",
        formatted: "Long Street Name 12\nSecond Row\n12345 Stockholm\nStockholm\nSweden",
        locality: "Stockholm",
        postal_code: "12345",
        region: "Stockholm",
        street_address: "Long Street Name 12\nSecond Row",
      },
      birth_date: "2000-01-01",
      display_name: `${identity.displayName.name}#${identity.displayName
        .number!.toString()
        .padStart(4, "0")}`,
      email: email.value,
      email_verified: true,
      family_name: "Torsson",
      gender: "Female",
      given_name: "Oliver",
      avatar_uri: "https://avatar.url/",
      locale: "sv-SE",
      middle_name: "Rio",
      name: "Olivia Torsson",
      national_identity_number: nin.value,
      national_identity_number_verified: true,
      nickname: "Wheat",
      phone_number: phone.value,
      phone_number_verified: false,
      picture: "https://picture.url/",
      preferred_accessibility: ["setting1", "setting2", "setting3"],
      preferred_username: "rio_wheat",
      profile: "https://profile.url/",
      pronouns: "she/her",
      social_security_number: ssn.value,
      social_security_number_verified: false,
      sub: identity.id,
      taken_name: "Olivia",
      updated_at: 1609488000,
      username: identity.username,
      website: "https://website.url/",
      zone_info: "Europe/Stockholm",
    });
  });
});
