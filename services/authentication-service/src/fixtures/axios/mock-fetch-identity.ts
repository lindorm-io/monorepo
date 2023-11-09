import { NamingSystem } from "@lindorm-io/common-enums";
import { GetIdentityResponse } from "@lindorm-io/common-types";

export const mockFetchIdentity = (
  options: Partial<GetIdentityResponse> = {},
): GetIdentityResponse => ({
  active: true,
  avatarUri: "https://avatar.url/",
  birthDate: "2000-01-01",
  displayName: "RioWheat#1234",
  familyName: "Torsson",
  gender: "Female",
  givenName: "Oliver",
  locale: "sv-SE",
  middleName: "Rio",
  name: "Oliver Torsson",
  namingSystem: NamingSystem.GIVEN_FAMILY,
  nickname: "Wheat",
  picture: "https://picture.url/",
  preferredAccessibility: ["setting1", "setting2", "setting3"],
  preferredName: "Olivia",
  preferredUsername: "rio_wheat",
  profile: "https://profile.url/",
  pronouns: "she/her",
  username: "rio_wheat",
  website: "https://website.url/",
  zoneInfo: "Europe/Stockholm",

  addresses: [
    {
      careOf: null,
      country: "Sweden",
      label: "Home",
      locality: "Stockholm",
      postalCode: "12345",
      primary: true,
      region: "Stockholm",
      streetAddress: ["Test Road 1"],
    },
  ],
  connectedProviders: ["apple", "google", "github", "microsoft"],
  emails: [
    {
      email: "rio.wheat@home.com",
      label: "Home",
      primary: true,
      verified: true,
    },
    {
      email: "oliver.torsson@work.com",
      label: "Work",
      primary: false,
      verified: true,
    },
  ],
  nationalIdentityNumbers: [
    {
      label: "Home",
      nin: "200001011234",
      primary: true,
      provider: "skatteverket",
      verified: true,
    },
  ],
  phoneNumbers: [
    {
      label: "Home",
      phoneNumber: "+46700000000",
      primary: true,
      verified: true,
    },
  ],
  socialSecurityNumbers: [
    {
      label: "Home",
      primary: true,
      provider: "skatteverket",
      ssn: "200001011234",
      verified: true,
    },
  ],
  ...options,
});
