import { Identity, IdentityOptions } from "../../entity";
import { NamingSystem } from "../../enum";
import { getRandomNumber, getRandomString } from "@lindorm-io/core";

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
    nationalIdentityNumber: getRandomNumber(12).toString().padEnd(12, "0"),
    nationalIdentityNumberVerified: true,
    nickname: "Wheat",
    picture: "https://picture.url/",
    preferredAccessibility: ["setting1", "setting2", "setting3"],
    preferredUsername: "rio_wheat",
    profile: "https://profile.url/",
    pronouns: "she/her",
    socialSecurityNumber: getRandomNumber(12).toString().padEnd(12, "0"),
    socialSecurityNumberVerified: true,
    username: getRandomString(16),
    website: "https://website.url/",
    zoneInfo: "Europe/Stockholm",
    ...options,
  });
