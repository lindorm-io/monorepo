import { Identity, IdentityOptions } from "../../entity";
import { NamingSystem } from "../../enum";
import { getRandomNumber, getRandomString } from "@lindorm-io/core";

export const createTestIdentity = (options: Partial<IdentityOptions> = {}): Identity =>
  new Identity({
    address: {
      careOf: "careOf",
      country: "country",
      locality: "locality",
      postalCode: "postalCode",
      region: "region",
      streetAddress: ["streetAddress1", "streetAddress2"],
    },
    birthDate: "2000-01-01",
    displayName: {
      name: null,
      number: null,
    },
    familyName: "familyName",
    gender: "gender",
    givenName: "givenName",
    gravatarUri: "https://gravatar.url/",
    locale: "sv-SE",
    middleName: "middleName",
    namingSystem: NamingSystem.GIVEN_FAMILY,
    nationalIdentityNumber: getRandomNumber(12).toString().padEnd(12, "0"),
    nationalIdentityNumberVerified: true,
    nickname: "nickname",
    picture: "https://picture.url/",
    preferredAccessibility: ["setting1", "setting2", "setting3"],
    preferredUsername: "username",
    profile: "https://profile.url/",
    pronouns: "she/her",
    socialSecurityNumber: getRandomNumber(12).toString().padEnd(12, "0"),
    socialSecurityNumberVerified: true,
    username: getRandomString(16),
    website: "https://website.url/",
    zoneInfo: "Europe/Stockholm",
    ...options,
  });
