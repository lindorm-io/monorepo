import { NamingSystem } from "@lindorm-io/common-enums";
import { randomString } from "@lindorm-io/random";
import { Identity, IdentityOptions } from "../../entity";

export const createTestIdentity = (options: Partial<IdentityOptions> = {}): Identity =>
  new Identity({
    birthDate: "2000-01-01",
    displayName: {
      name: null,
      number: null,
    },
    familyName: "Torsson",
    gender: "Female",
    givenName: "Oliver",
    avatarUri: "https://avatar.url/",
    locale: "sv-SE",
    maritalStatus: "Single",
    middleName: "Rio",
    namingSystem: NamingSystem.GIVEN_FAMILY,
    nickname: "Wheat",
    picture: "https://picture.url/",
    preferredAccessibility: ["setting1", "setting2", "setting3"],
    preferredUsername: "rio_wheat",
    profile: "https://profile.url/",
    pronouns: "she/her",
    preferredName: "Olivia",
    username: randomString(16),
    website: "https://website.url/",
    zoneInfo: "Europe/Stockholm",
    ...options,
  });
