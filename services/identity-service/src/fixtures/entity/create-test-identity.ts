import { Identity, IdentityOptions } from "../../entity";
import { NamingSystem } from "../../enum";
import { randomNumber, randomString } from "@lindorm-io/random";

export const createTestIdentity = (options: Partial<IdentityOptions> = {}): Identity =>
  new Identity({
    birthDate: "2000-01-01",
    displayName: {
      name: null,
      number: null,
    },
    familyName: "Torsson",
    gender: "Female",
    givenName: "Alexandra",
    gravatarUri: "https://gravatar.url/",
    locale: "sv-SE",
    middleName: "Rio",
    namingSystem: NamingSystem.GIVEN_FAMILY,
    nationalIdentityNumber: randomNumber(12).toString().padEnd(12, "0"),
    nationalIdentityNumberVerified: true,
    nickname: "Wheat",
    picture: "https://picture.url/",
    preferredAccessibility: ["setting1", "setting2", "setting3"],
    preferredUsername: "rio_wheat",
    profile: "https://profile.url/",
    pronouns: "she/her",
    socialSecurityNumber: randomNumber(12).toString().padEnd(12, "0"),
    socialSecurityNumberVerified: true,
    username: randomString(16),
    website: "https://website.url/",
    zoneInfo: "Europe/Stockholm",
    ...options,
  });
