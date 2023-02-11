import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { randomNumber, randomString } from "@lindorm-io/random";
import { server } from "../server/server";
import {
  createTestAddress,
  createTestEmailIdentifier,
  createTestExternalIdentifier,
  createTestIdentity,
  createTestPhoneIdentifier,
} from "../fixtures/entity";
import {
  TEST_ADDRESS_REPOSITORY,
  TEST_IDENTIFIER_REPOSITORY,
  TEST_IDENTITY_REPOSITORY,
  getTestAccessToken,
  setupIntegration,
} from "../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/userinfo", () => {
  beforeAll(setupIntegration);

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      access_token: "accessToken",
      expires_in: 100,
      scope: ["scope"],
    });

  nock("https://communication.test.lindorm.io")
    .post("/internal/send/code")
    .times(999)
    .reply(200, {});

  test("GET /", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      createTestIdentity({
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

    const external = await TEST_IDENTIFIER_REPOSITORY.create(
      createTestExternalIdentifier({
        identityId: identity.id,
      }),
    );

    const bearerToken = getTestAccessToken({
      subject: identity.id,
    });

    const response = await request(server.callback())
      .get("/userinfo")
      .set("Authorization", `Bearer ${bearerToken}`)
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
      connected_providers: [external.provider],
      display_name: `${identity.displayName.name}#${identity.displayName
        .number!.toString()
        .padStart(4, "0")}`,
      email: email.identifier,
      email_verified: true,
      family_name: "Torsson",
      gender: "Female",
      given_name: "Oliver",
      gravatar_uri: "https://gravatar.url/",
      locale: "sv-SE",
      middle_name: "Rio",
      name: "Olivia Torsson",
      national_identity_number: identity.nationalIdentityNumber,
      national_identity_number_verified: true,
      nickname: "Wheat",
      phone_number: phone.identifier,
      phone_number_verified: false,
      picture: "https://picture.url/",
      preferred_accessibility: ["setting1", "setting2", "setting3"],
      preferred_username: "rio_wheat",
      profile: "https://profile.url/",
      pronouns: "she/her",
      social_security_number: identity.socialSecurityNumber,
      social_security_number_verified: true,
      sub: identity.id,
      taken_name: "Olivia",
      updated_at: 1609488000,
      username: identity.username,
      website: "https://website.url/",
      zone_info: "Europe/Stockholm",
    });
  });
});
