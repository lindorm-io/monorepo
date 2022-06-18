import MockDate from "mockdate";
import request from "supertest";
import { Identity } from "../../entity";
import { randomNumber, randomString } from "@lindorm-io/core";
import { server } from "../../server/server";
import {
  getTestAccessToken,
  setupIntegration,
  TEST_ADDRESS_REPOSITORY,
  TEST_IDENTIFIER_REPOSITORY,
  TEST_IDENTITY_REPOSITORY,
} from "../../fixtures/integration";
import {
  createTestAddress,
  createTestEmailIdentifier,
  createTestExternalIdentifier,
  createTestIdentity,
  createTestPhoneIdentifier,
} from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/identity", () => {
  beforeAll(setupIntegration);

  test("GET /", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      createTestIdentity({
        displayName: {
          name: randomString(10),
          number: randomNumber(4),
        },
      }),
    );

    const address = await TEST_ADDRESS_REPOSITORY.create(
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

    const accessToken = getTestAccessToken({
      subject: identity.id,
    });

    const response = await request(server.callback())
      .get("/identity")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      active: true,
      addresses: [
        {
          id: address.id,
          careOf: "Gustav Torsson",
          country: "Sweden",
          label: "work",
          locality: "Stockholm",
          postalCode: "12345",
          region: "Stockholm",
          streetAddress: ["Long Street Name 12", "Second Row"],
        },
      ],
      birth_date: "2000-01-01",
      connected_providers: [external.provider],
      display_name: `${identity.displayName.name}#${identity.displayName.number
        .toString()
        .padStart(4, "0")}`,
      emails: [
        {
          id: email.id,
          label: "home",
          primary: true,
          value: email.identifier,
          verified: true,
        },
      ],
      family_name: "Torsson",
      gender: "Female",
      given_name: "Alexandra",
      gravatar_uri: "https://gravatar.url/",
      locale: "sv-SE",
      middle_name: "Rio",
      name: "Alexandra Torsson",
      national_identity_number: identity.nationalIdentityNumber,
      national_identity_number_verified: true,
      nickname: "Wheat",
      permissions: [
        "lindorm.io/any/identity/any:user",
        "lindorm.io/oauth-service/identity/client:read",
        "lindorm.io/oauth-service/identity/client:write",
        "lindorm.io/identity-service/identity/identity:read",
        "lindorm.io/identity-service/identity/identity:write",
        "lindorm.io/oauth-service/identity/tenant:read",
        "lindorm.io/oauth-service/identity/tenant:write",
      ],
      phone_numbers: [
        {
          id: phone.id,
          label: "home",
          primary: true,
          value: phone.identifier,
          verified: false,
        },
      ],
      picture: "https://picture.url/",
      preferred_accessibility: ["setting1", "setting2", "setting3"],
      preferred_username: "rio_wheat",
      profile: "https://profile.url/",
      pronouns: "she/her",
      social_security_number: identity.socialSecurityNumber,
      social_security_number_verified: true,
      username: identity.username,
      website: "https://website.url/",
      zone_info: "Europe/Stockholm",
    });
  });

  test("PATCH /", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(new Identity({}));

    const username = randomString(16);

    const accessToken = getTestAccessToken({
      subject: identity.id,
    });

    await request(server.callback())
      .patch("/identity")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        birth_date: "2010-01-01",
        family_name: "new_familyName",
        gender: "new_gender",
        given_name: "new_givenName",
        locale: "en-GB",
        middle_name: "new_middleName",
        nickname: "new_nickname",
        picture: "https://picture.url/new/",
        profile: "https://profile.url/new/",
        username,
        website: "https://website.url/new/",
        zone_info: "Europe/Berlin",
      })
      .expect(204);
  });
});
