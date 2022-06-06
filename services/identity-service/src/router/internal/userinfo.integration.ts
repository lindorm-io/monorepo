import MockDate from "mockdate";
import nock from "nock";
import request from "supertest";
import { IdentifierType, IdentityPermission, Scope } from "../../common";
import { Identity } from "../../entity";
import { createTestIdentity } from "../../fixtures/entity";
import { find } from "lodash";
import { getRandomNumber, getRandomString } from "@lindorm-io/core";
import { server } from "../../server/server";
import {
  getTestClientCredentials,
  setupIntegration,
  TEST_IDENTIFIER_REPOSITORY,
  TEST_IDENTITY_REPOSITORY,
} from "../../fixtures/integration";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/internal/userinfo", () => {
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

  test("GET /:id", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      createTestIdentity({
        displayName: {
          name: getRandomString(12),
          number: getRandomNumber(4),
        },
      }),
    );

    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .get(`/internal/userinfo/${identity.id}?scope=${Object.values(Scope).join("+")}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      active: true,
      claims: {
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
        connected_providers: [],
        display_name: `${identity.displayName.name}#${identity.displayName.number
          .toString()
          .padStart(4, "0")}`,
        email: null,
        email_verified: false,
        family_name: "familyName",
        gender: "gender",
        given_name: "givenName",
        gravatar_uri: "https://gravatar.url/",
        locale: "sv-SE",
        middle_name: "middleName",
        name: "givenName familyName",
        national_identity_number: identity.nationalIdentityNumber,
        national_identity_number_verified: true,
        nickname: "nickname",
        phone_number: null,
        phone_number_verified: false,
        picture: "https://picture.url/",
        preferred_accessibility: ["setting1", "setting2", "setting3"],
        preferred_username: "username",
        profile: "https://profile.url/",
        pronouns: "she/her",
        social_security_number: identity.socialSecurityNumber,
        social_security_number_verified: true,
        sub: identity.id,
        updated_at: 1609488000,
        username: identity.username,
        website: "https://website.url/",
        zone_info: "Europe/Stockholm",
      },
      permissions: [
        IdentityPermission.USER,
        IdentityPermission.CLIENT_READ,
        IdentityPermission.CLIENT_WRITE,
        IdentityPermission.IDENTITY_READ,
        IdentityPermission.IDENTITY_WRITE,
        IdentityPermission.TENANT_READ,
        IdentityPermission.TENANT_WRITE,
      ],
    });
  });

  test("PUT /:id", async () => {
    const identity = new Identity({});
    identity.username = null;

    const email = `new-${getRandomString(16)}@lindorm.io`;
    const phone = `+${getRandomNumber(12)}`;
    const sub = getRandomString(32);
    const username = getRandomString(16);

    await TEST_IDENTITY_REPOSITORY.create(identity);

    const clientCredentials = getTestClientCredentials();

    await request(server.callback())
      .put(`/internal/userinfo/${identity.id}`)
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
        email: email,
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
        identifier: email,
      }),
    );

    expect(find(identifiers, { type: IdentifierType.EXTERNAL })).toStrictEqual(
      expect.objectContaining({
        identifier: sub,
      }),
    );

    expect(find(identifiers, { type: IdentifierType.PHONE })).toStrictEqual(
      expect.objectContaining({
        identifier: phone,
      }),
    );

    await expect(TEST_IDENTITY_REPOSITORY.find({ id: identity.id })).resolves.toStrictEqual(
      expect.objectContaining({
        address: {
          careOf: null,
          country: "new_country",
          locality: "new_locality",
          postalCode: "new_postalCode",
          region: "new_region",
          streetAddress: ["new_streetAddress1", "new_streetAddress2"],
        },
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
  });
});
