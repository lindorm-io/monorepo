import MockDate from "mockdate";
import request from "supertest";
import { getRandomNumber, getRandomString } from "@lindorm-io/core";
import { server } from "../../server/server";
import { createTestIdentity } from "../../fixtures/entity";
import {
  TEST_EMAIL_REPOSITORY,
  TEST_IDENTITY_REPOSITORY,
  TEST_EXTERNAL_IDENTIFIER_REPOSITORY,
  TEST_PHONE_NUMBER_REPOSITORY,
  getTestClientCredentials,
  setupIntegration,
} from "../../fixtures/integration";
import { Identity } from "../../entity";
import { IdentityPermission } from "../../common";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/internal/userinfo", () => {
  beforeAll(setupIntegration);

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
      .get(`/internal/userinfo/${identity.id}?scope=openid`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      active: true,
      claims: {
        sub: identity.id,
        updated_at: 1609488000,
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

    await expect(TEST_EMAIL_REPOSITORY.find({ identityId: identity.id })).resolves.toStrictEqual(
      expect.objectContaining({
        email: email,
        identityId: identity.id,
        primary: true,
        verified: false,
      }),
    );

    await expect(
      TEST_PHONE_NUMBER_REPOSITORY.find({ identityId: identity.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        phoneNumber: phone,
        identityId: identity.id,
        primary: true,
        verified: false,
      }),
    );

    await expect(
      TEST_EXTERNAL_IDENTIFIER_REPOSITORY.find({ identityId: identity.id }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        identifier: sub,
        identityId: identity.id,
        provider: "https://github.com/",
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
