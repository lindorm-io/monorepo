import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { TEST_GET_USERINFO_RESPONSE } from "../fixtures/data";
import { server } from "../server/server";
import { getTestAccessToken, setupIntegration } from "../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/userinfo", () => {
  beforeAll(setupIntegration);

  nock("https://identity.test.lindorm.io")
    .get("/userinfo")
    .times(999)
    .reply(200, TEST_GET_USERINFO_RESPONSE);

  test("GET /", async () => {
    const accessToken = await getTestAccessToken({
      subject: "d821cde6-250f-4918-ad55-877a7abf0271",
    });

    const response = await request(server.callback())
      .get("/userinfo")
      .set("Authorization", `Bearer ${accessToken}`)
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
      birth_date: "2000-01-01",
      display_name: "displayName#8441",
      email: "test@lindorm.io",
      email_verified: true,
      family_name: "familyName",
      gender: "gender",
      given_name: "givenName",
      gravatar_uri: "https://gravatar.url/",
      locale: "sv-SE",
      middle_name: "middleName",
      name: "givenName familyName",
      nickname: "nickname",
      phone_number: "+46705498721",
      phone_number_verified: true,
      picture: "https://picture.url/",
      preferred_accessibility: ["setting1", "setting2", "setting3"],
      preferred_username: "username",
      profile: "https://profile.url/",
      pronouns: "she/her",
      social_security_number: "198056702895",
      sub: "d821cde6-250f-4918-ad55-877a7abf0271",
      updated_at: 1609488000,
      username: "identityUsername",
      website: "https://website.url/",
      zone_info: "Europe/Stockholm",
    });
  });
});
