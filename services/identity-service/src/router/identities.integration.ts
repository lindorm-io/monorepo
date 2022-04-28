import MockDate from "mockdate";
import request from "supertest";
import { Identity } from "../entity";
import { EntityNotFoundError } from "@lindorm-io/entity";
import { koa } from "../server/koa";
import { randomUUID } from "crypto";
import {
  getTestDisplayName,
  getTestEmail,
  getTestIdentity,
  getTestExternalIdentifier,
  getTestPhoneNumber,
} from "../test/entity";
import {
  TEST_DISPLAY_NAME_REPOSITORY,
  TEST_EMAIL_REPOSITORY,
  TEST_IDENTITY_REPOSITORY,
  TEST_EXTERNAL_IDENTIFIER_REPOSITORY,
  TEST_PHONE_NUMBER_REPOSITORY,
  getTestAccessToken,
  setupIntegration,
} from "../test/integration";
import { getRandomString } from "@lindorm-io/core";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("/identities", () => {
  beforeAll(setupIntegration);

  test("GET /:id", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      getTestIdentity({
        id: randomUUID(),
      }),
    );
    const email = await TEST_EMAIL_REPOSITORY.create(
      getTestEmail({
        identityId: identity.id,
      }),
    );
    const oidc = await TEST_EXTERNAL_IDENTIFIER_REPOSITORY.create(
      getTestExternalIdentifier({
        identityId: identity.id,
      }),
    );
    const phone = await TEST_PHONE_NUMBER_REPOSITORY.create(
      getTestPhoneNumber({
        identityId: identity.id,
      }),
    );

    const accessToken = getTestAccessToken({
      subject: identity.id,
    });

    const response = await request(koa.callback())
      .get(`/identities/${identity.id}/`)
      .set("Authorization", `Bearer ${accessToken}`)
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
        connected_providers: [oidc.provider],
        display_name: null,
        email: email.email,
        email_verified: true,
        family_name: "familyName",
        gender: "gender",
        given_name: "givenName",
        gravatar_uri: "https://gravatar.url/",
        locale: "sv-SE",
        middle_name: "middleName",
        name: "givenName familyName",
        national_identity_number: identity.nationalIdentityNumber,
        nickname: "nickname",
        phone_number: phone.phoneNumber,
        phone_number_verified: true,
        picture: "https://picture.url/",
        preferred_accessibility: ["setting1", "setting2", "setting3"],
        preferred_username: "username",
        profile: "https://profile.url/",
        pronouns: "she/her",
        social_security_number: identity.socialSecurityNumber,
        sub: identity.id,
        updated_at: 1609488000,
        username: identity.username,
        website: "https://website.url/",
        zone_info: "Europe/Stockholm",
      },
      permissions: ["lindorm.io/any/identity/any:user"],
    });
  });

  test("PUT /:id", async () => {
    const identity = new Identity({});
    identity.username = null;

    await TEST_IDENTITY_REPOSITORY.create(identity);

    const username = getRandomString(16);

    const accessToken = getTestAccessToken({ subject: identity.id });

    await request(koa.callback())
      .put(`/identities/${identity.id}/`)
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
        username: username,
        website: "https://website.url/new/",
        zone_info: "Europe/Berlin",
      })
      .expect(200);

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
  });

  test("DELETE /:id", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      getTestIdentity({
        id: randomUUID(),
        displayName: {
          name: "removeThisName",
          number: 9999,
        },
      }),
    );
    await TEST_DISPLAY_NAME_REPOSITORY.create(
      getTestDisplayName({
        name: identity.displayName.name,
        numbers: [identity.displayName.number],
      }),
    );

    const accessToken = getTestAccessToken({
      subject: identity.id,
    });

    await request(koa.callback())
      .delete(`/identities/${identity.id}/`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    await expect(TEST_IDENTITY_REPOSITORY.find({ id: identity.id })).rejects.toThrow(
      EntityNotFoundError,
    );
    await expect(
      TEST_DISPLAY_NAME_REPOSITORY.find({ name: identity.displayName.name }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        numbers: [],
      }),
    );
  });

  test("DELETE /:id/identifiers/:type", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      getTestIdentity({
        id: randomUUID(),
      }),
    );

    await TEST_EMAIL_REPOSITORY.create(
      getTestEmail({
        identityId: identity.id,
        email: "remove-identity-email@lindorm.io",
        primary: false,
      }),
    );

    const accessToken = getTestAccessToken({
      subject: identity.id,
    });

    await request(koa.callback())
      .delete(`/identities/${identity.id}/identifiers/email`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        email: "remove-identity-email@lindorm.io",
      })
      .expect(200);

    await expect(
      TEST_EMAIL_REPOSITORY.find({ email: "remove-identity-email@lindorm.io" }),
    ).rejects.toThrow(EntityNotFoundError);
  });

  test("PUT /:id/identifiers/:type/set-primary", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(
      getTestIdentity({
        id: randomUUID(),
      }),
    );

    await TEST_EMAIL_REPOSITORY.create(
      getTestEmail({
        identityId: identity.id,
        email: "primary-identity-email@lindorm.io",
        primary: false,
      }),
    );

    const accessToken = getTestAccessToken({
      subject: identity.id,
    });

    await request(koa.callback())
      .put(`/identities/${identity.id}/identifiers/email/set-primary`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        email: "primary-identity-email@lindorm.io",
      })
      .expect(200);

    await expect(
      TEST_EMAIL_REPOSITORY.find({ email: "primary-identity-email@lindorm.io" }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        primary: true,
      }),
    );
  });
});
