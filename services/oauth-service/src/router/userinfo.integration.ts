import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { TEST_GET_USERINFO_RESPONSE } from "../fixtures/data";
import { createTestAccessToken, createTestClientSession } from "../fixtures/entity";
import {
  TEST_CLIENT_SESSION_REPOSITORY,
  TEST_OPAQUE_TOKEN_CACHE,
  getTestAccessToken,
  setupIntegration,
} from "../fixtures/integration";
import { server } from "../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/userinfo", () => {
  beforeAll(setupIntegration);

  nock("https://identity.test.lindorm.io")
    .get("/userinfo")
    .times(999)
    .reply(200, TEST_GET_USERINFO_RESPONSE);

  test("should resolve user information on GET", async () => {
    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(createTestClientSession());

    const accessToken = await TEST_OPAQUE_TOKEN_CACHE.create(
      createTestAccessToken({
        clientSessionId: clientSession.id,
      }),
    );

    const bearerToken = getTestAccessToken({
      id: accessToken.id,
      subject: "d821cde6-250f-4918-ad55-877a7abf0271",
    });

    const response = await request(server.callback())
      .get("/userinfo")
      .set("Authorization", `Bearer ${bearerToken}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      active: true,
      address: {
        care_of: "careOf",
        country: "country",
        formatted: "streetAddress1\nstreetAddress2\npostalCode locality\nregion\ncountry",
        locality: "locality",
        postal_code: "postalCode",
        region: "region",
        street_address: "streetAddress1\nstreetAddress2",
      },
      avatar_uri: "https://avatar.url/",
      birth_date: "2000-01-01",
      display_name: "displayName#8441",
      email_verified: true,
      email: "test@lindorm.io",
      family_name: "familyName",
      gender: "gender",
      given_name: "givenName",
      locale: "sv-SE",
      middle_name: "middleName",
      name: "givenName familyName",
      national_identity_number_verified: true,
      national_identity_number: "198056702895",
      nickname: "nickname",
      phone_number_verified: true,
      phone_number: "+46705498721",
      picture: "https://picture.url/",
      preferred_accessibility: ["setting1", "setting2", "setting3"],
      preferred_username: "username",
      profile: "https://profile.url/",
      pronouns: "she/her",
      roles: ["role1", "role2"],
      social_security_number_verified: false,
      social_security_number: "198056702895",
      sub: "d821cde6-250f-4918-ad55-877a7abf0271",
      updated_at: 1609488000,
      username: "identityUsername",
      website: "https://website.url/",
      zone_info: "Europe/Stockholm",
    });
  });

  test("should resolve user information on POST", async () => {
    const clientSession = await TEST_CLIENT_SESSION_REPOSITORY.create(createTestClientSession());

    const accessToken = await TEST_OPAQUE_TOKEN_CACHE.create(
      createTestAccessToken({
        clientSessionId: clientSession.id,
      }),
    );

    const bearerToken = getTestAccessToken({
      id: accessToken.id,
      subject: "d821cde6-250f-4918-ad55-877a7abf0271",
    });

    const response = await request(server.callback())
      .post("/userinfo")
      .set("Authorization", `Bearer ${bearerToken}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      active: true,
      address: {
        care_of: "careOf",
        country: "country",
        formatted: "streetAddress1\nstreetAddress2\npostalCode locality\nregion\ncountry",
        locality: "locality",
        postal_code: "postalCode",
        region: "region",
        street_address: "streetAddress1\nstreetAddress2",
      },
      avatar_uri: "https://avatar.url/",
      birth_date: "2000-01-01",
      display_name: "displayName#8441",
      email_verified: true,
      email: "test@lindorm.io",
      family_name: "familyName",
      gender: "gender",
      given_name: "givenName",
      locale: "sv-SE",
      middle_name: "middleName",
      name: "givenName familyName",
      national_identity_number_verified: true,
      national_identity_number: "198056702895",
      nickname: "nickname",
      phone_number_verified: true,
      phone_number: "+46705498721",
      picture: "https://picture.url/",
      preferred_accessibility: ["setting1", "setting2", "setting3"],
      preferred_username: "username",
      profile: "https://profile.url/",
      pronouns: "she/her",
      roles: ["role1", "role2"],
      social_security_number_verified: false,
      social_security_number: "198056702895",
      sub: "d821cde6-250f-4918-ad55-877a7abf0271",
      updated_at: 1609488000,
      username: "identityUsername",
      website: "https://website.url/",
      zone_info: "Europe/Stockholm",
    });
  });
});
