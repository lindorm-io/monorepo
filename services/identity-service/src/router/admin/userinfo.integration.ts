import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { IdentifierType } from "@lindorm-io/common-types";
import { Identity } from "../../entity";
import { find } from "lodash";
import { randomNumber, randomString } from "@lindorm-io/random";
import { server } from "../../server/server";
import {
  getTestClientCredentials,
  setupIntegration,
  TEST_ADDRESS_REPOSITORY,
  TEST_IDENTIFIER_REPOSITORY,
  TEST_IDENTITY_REPOSITORY,
} from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/admin/userinfo", () => {
  beforeAll(setupIntegration);

  nock("https://oauth.test.lindorm.io")
    .get("/.well-known/openid-configuration")
    .times(999)
    .reply(200, {
      token_endpoint: "https://oauth.test.lindorm.io/oauth2/token",
    });

  nock("https://oauth.test.lindorm.io")
    .post("/oauth2/token")
    .times(999)
    .reply(200, {
      access_token: "accessToken",
      expires_in: 100,
      scope: ["scope"],
    });

  test("PUT /:id", async () => {
    const identity = new Identity({});
    identity.username = null;

    const email = `new-${randomString(16)}@lindorm.io`;
    const phone = `+${randomNumber(12)}`;
    const sub = randomString(32);
    const username = randomString(16);

    await TEST_IDENTITY_REPOSITORY.create(identity);

    const clientCredentials = getTestClientCredentials();

    await request(server.callback())
      .put(`/admin/userinfo/${identity.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        provider: "https://github.com/",
        sub,
        updated_at: 1609489000,

        address: {
          country: "new_country",
          locality: "new_locality",
          postal_code: "new_postalCode",
          region: "new_region",
          street_address: "new_streetAddress1\nnew_streetAddress2",
        },
        birth_date: "2010-01-01",
        email,
        email_verified: true,
        family_name: "new_familyName",
        gender: "new_gender",
        given_name: "new_givenName",
        locale: "en-GB",
        middle_name: "new_middleName",
        nickname: "new_nickname",
        phone_number: phone,
        phone_number_verified: true,
        picture: "https://picture.url/new/",
        preferred_username: username,
        profile: "https://profile.url/new/",
        website: "https://website.url/new/",
        zone_info: "Europe/Berlin",
      })
      .expect(204);

    const identifiers = await TEST_IDENTIFIER_REPOSITORY.findMany({ identityId: identity.id });

    expect(find(identifiers, { type: IdentifierType.EMAIL })).toStrictEqual(
      expect.objectContaining({
        value: email,
      }),
    );

    expect(find(identifiers, { type: IdentifierType.EXTERNAL })).toStrictEqual(
      expect.objectContaining({
        value: sub,
      }),
    );

    expect(find(identifiers, { type: IdentifierType.PHONE })).toStrictEqual(
      expect.objectContaining({
        value: phone,
      }),
    );

    await expect(TEST_IDENTITY_REPOSITORY.find({ id: identity.id })).resolves.toStrictEqual(
      expect.objectContaining({
        birthDate: "2010-01-01",
        familyName: "new_familyName",
        gender: "new_gender",
        givenName: "new_givenName",
        locale: "en-GB",
        middleName: "new_middleName",
        nickname: "new_nickname",
        picture: "https://picture.url/new/",
        preferredUsername: username,
        profile: "https://profile.url/new/",
        username: username,
        website: "https://website.url/new/",
        zoneInfo: "Europe/Berlin",
      }),
    );

    await expect(TEST_ADDRESS_REPOSITORY.find({ identityId: identity.id })).resolves.toStrictEqual(
      expect.objectContaining({
        careOf: null,
        country: "new_country",
        locality: "new_locality",
        postalCode: "new_postalCode",
        region: "new_region",
        streetAddress: ["new_streetAddress1", "new_streetAddress2"],
      }),
    );
  });
});
