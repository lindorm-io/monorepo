import { NamingSystem } from "@lindorm-io/common-types";
import MockDate from "mockdate";
import request from "supertest";
import { createTestIdentity } from "../../fixtures/entity";
import {
  getTestClientCredentials,
  setupIntegration,
  TEST_DISPLAY_NAME_REPOSITORY,
  TEST_IDENTITY_REPOSITORY,
} from "../../fixtures/integration";
import { server } from "../../server/server";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.unmock("@lindorm-io/mongo");
jest.unmock("@lindorm-io/redis");

describe("/admin/identities", () => {
  beforeAll(setupIntegration);

  test("PUT /:id", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(createTestIdentity());

    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .put(`/admin/identities/${identity.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      active: true,
      addresses: [],
      birth_date: "2000-01-01",
      connected_providers: [],
      display_name: null,
      emails: [],
      family_name: "Torsson",
      gender: "Female",
      given_name: "Oliver",
      avatar_uri: "https://avatar.url/",
      locale: "sv-SE",
      middle_name: "Rio",
      naming_system: "given_family",
      national_identity_numbers: [],
      nickname: "Wheat",
      phone_numbers: [],
      picture: "https://picture.url/",
      preferred_accessibility: ["setting1", "setting2", "setting3"],
      preferred_username: "rio_wheat",
      profile: "https://profile.url/",
      pronouns: "she/her",
      social_security_numbers: [],
      preferred_name: "Olivia",
      username: expect.any(String),
      website: "https://website.url/",
      zone_info: "Europe/Stockholm",
    });
  });

  test("GET /:id", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(createTestIdentity());

    const clientCredentials = getTestClientCredentials();

    const response = await request(server.callback())
      .put(`/admin/identities/${identity.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .expect(200);

    expect(response.body).toStrictEqual({
      active: true,
      addresses: [],
      birth_date: "2000-01-01",
      connected_providers: [],
      display_name: null,
      emails: [],
      family_name: "Torsson",
      gender: "Female",
      given_name: "Oliver",
      avatar_uri: "https://avatar.url/",
      locale: "sv-SE",
      middle_name: "Rio",
      naming_system: "given_family",
      national_identity_numbers: [],
      nickname: "Wheat",
      phone_numbers: [],
      picture: "https://picture.url/",
      preferred_accessibility: ["setting1", "setting2", "setting3"],
      preferred_username: "rio_wheat",
      profile: "https://profile.url/",
      pronouns: "she/her",
      social_security_numbers: [],
      preferred_name: "Olivia",
      username: expect.any(String),
      website: "https://website.url/",
      zone_info: "Europe/Stockholm",
    });
  });

  test("PATCH /:id", async () => {
    const identity = await TEST_IDENTITY_REPOSITORY.create(createTestIdentity());

    const clientCredentials = getTestClientCredentials();

    await request(server.callback())
      .patch(`/admin/identities/${identity.id}`)
      .set("Authorization", `Bearer ${clientCredentials}`)
      .send({
        active: false,
        birth_date: "2023-01-01",
        display_name: "NewDisplayName",
        family_name: "hello",
        gender: "nope",
        given_name: "world",
        avatar_uri: "https://new.user.url/avatar",
        locale: "no-NO",
        middle_name: "whatever",
        naming_system: NamingSystem.FAMILY_GIVEN,
        nickname: "anything",
        picture: "https://new.user.url/picture",
        preferred_accessibility: ["one", "two", "three"],
        profile: "https://new.user.url/profile",
        pronouns: "they/them",
        preferred_name: "something",
        website: "https://new.user.url/website",
        zone_info: "Europe/Oslo",
      })
      .expect(204);

    await expect(TEST_IDENTITY_REPOSITORY.find({ id: identity.id })).resolves.toStrictEqual(
      expect.objectContaining({
        active: false,
        birthDate: "2023-01-01",
        displayName: {
          name: "NewDisplayName",
          number: expect.any(Number),
        },
        familyName: "hello",
        gender: "nope",
        givenName: "world",
        avatarUri: "https://new.user.url/avatar",
        locale: "no-NO",
        middleName: "whatever",
        namingSystem: "family_given",
        nickname: "anything",
        picture: "https://new.user.url/picture",
        preferredAccessibility: ["one", "two", "three"],
        profile: "https://new.user.url/profile",
        pronouns: "they/them",
        revision: 1,
        preferredName: "something",
        website: "https://new.user.url/website",
        zoneInfo: "Europe/Oslo",
      }),
    );

    await expect(
      TEST_DISPLAY_NAME_REPOSITORY.find({ name: "NewDisplayName" }),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        name: "NewDisplayName",
        number: 1,
        revision: 1,
      }),
    );
  });
});
