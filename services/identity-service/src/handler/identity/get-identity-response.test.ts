import { createMockMongoRepository } from "@lindorm-io/mongo";
import { Identity } from "../../entity";
import {
  createTestAddress,
  createTestEmailIdentifier,
  createTestExternalIdentifier,
  createTestIdentity,
  createTestNinIdentifier,
  createTestPhoneIdentifier,
  createTestSsnIdentifier,
} from "../../fixtures/entity";
import { getIdentityResponse } from "./get-identity-response";

describe("getIdentityResponse", () => {
  let ctx: any;
  let identity: Identity;

  beforeEach(() => {
    ctx = {
      mongo: {
        addressRepository: createMockMongoRepository(createTestAddress),
        identifierRepository: createMockMongoRepository(createTestEmailIdentifier),
      },
    };

    identity = createTestIdentity({
      username: "rio_wheat",
    });
  });

  test("should resolve", async () => {
    ctx.mongo.addressRepository.findMany.mockResolvedValue([
      createTestAddress({ label: "home" }),
      createTestAddress({ primary: false }),
    ]);

    ctx.mongo.identifierRepository.findMany.mockResolvedValue([
      createTestEmailIdentifier({ value: "one@lindorm.io", primary: true }),
      createTestEmailIdentifier({ value: "two@lindorm.io", primary: false, verified: false }),
      createTestExternalIdentifier({ provider: "apple", value: "three" }),
      createTestExternalIdentifier({ provider: "google", value: "four" }),
      createTestNinIdentifier({ value: "123123123" }),
      createTestNinIdentifier({ value: "456456456", primary: false, verified: false }),
      createTestPhoneIdentifier({ value: "1111", primary: true }),
      createTestPhoneIdentifier({ value: "2222", primary: false, verified: false }),
      createTestSsnIdentifier({ value: "789789789" }),
      createTestSsnIdentifier({ value: "123456789", primary: false, verified: false }),
    ]);

    await expect(getIdentityResponse(ctx, identity)).resolves.toStrictEqual({
      active: true,
      addresses: [
        {
          careOf: "Gustav Torsson",
          country: "Sweden",
          label: "home",
          locality: "Stockholm",
          postalCode: "12345",
          primary: true,
          region: "Stockholm",
          streetAddress: ["Long Street Name 12", "Second Row"],
        },
        {
          careOf: "Gustav Torsson",
          country: "Sweden",
          label: "work",
          locality: "Stockholm",
          postalCode: "12345",
          primary: false,
          region: "Stockholm",
          streetAddress: ["Long Street Name 12", "Second Row"],
        },
      ],
      birthDate: "2000-01-01",
      connectedProviders: ["apple", "google"],
      displayName: null,
      emails: [
        {
          email: "one@lindorm.io",
          label: "home",
          primary: true,
          verified: true,
        },
        {
          email: "two@lindorm.io",
          label: "home",
          primary: false,
          verified: false,
        },
      ],
      familyName: "Torsson",
      gender: "Female",
      givenName: "Oliver",
      avatarUri: "https://avatar.url/",
      locale: "sv-SE",
      middleName: "Rio",
      namingSystem: "given_family",
      nationalIdentityNumbers: [
        {
          label: "home",
          nin: "123123123",
          primary: true,
          provider: "https://test.lindorm.io",
          verified: true,
        },
        {
          label: "home",
          nin: "456456456",
          primary: false,
          provider: "https://test.lindorm.io",
          verified: false,
        },
      ],
      nickname: "Wheat",
      phoneNumbers: [
        {
          label: "home",
          phoneNumber: "1111",
          primary: true,
          verified: true,
        },
        {
          label: "home",
          phoneNumber: "2222",
          primary: false,
          verified: false,
        },
      ],
      picture: "https://picture.url/",
      preferredAccessibility: ["setting1", "setting2", "setting3"],
      preferredUsername: "rio_wheat",
      profile: "https://profile.url/",
      pronouns: "she/her",
      socialSecurityNumbers: [
        {
          label: "home",
          primary: true,
          provider: "https://test.lindorm.io",
          ssn: "123123123",
          verified: true,
        },
        {
          label: "home",
          primary: false,
          provider: "https://test.lindorm.io",
          ssn: "456456456",
          verified: false,
        },
      ],
      preferredName: "Olivia",
      username: "rio_wheat",
      website: "https://website.url/",
      zoneInfo: "Europe/Stockholm",
    });
  });
});
