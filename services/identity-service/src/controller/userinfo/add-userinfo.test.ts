import { Identity } from "../../entity";
import { logger } from "../../test/logger";
import { addUserinfoController } from "./add-userinfo";

jest.mock("../../handler", () => ({
  userinfoEmailAdd: jest.fn().mockImplementation(async () => {}),
  userinfoExternalIdentifierAdd: jest.fn().mockImplementation(async () => {}),
  userinfoPhoneNumberAdd: jest.fn().mockImplementation(async () => {}),
  userinfoUsernameAdd: jest.fn().mockImplementation(async () => {}),
}));

describe("addUserinfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        address: {
          country: "country",
          locality: "locality",
          postalCode: "postalCode",
          region: "region",
          streetAddress: "streetAddress 1\nstreetAddress 2",
        },
        birthDate: "birthDate",
        email: "email",
        familyName: "familyName",
        gender: "gender",
        givenName: "givenName",
        locale: "locale",
        middleName: "middleName",
        nickname: "nickname",
        phoneNumber: "phoneNumber",
        picture: "picture",
        preferredUsername: "preferredUsername",
        profile: "profile",
        provider: "provider",
        sub: "sub",
        updatedAt: "updatedAt",
        website: "website",
        zoneInfo: "zoneInfo",
      },
      entity: {
        identity: new Identity({}),
      },
      logger,
      repository: {
        identityRepository: {
          update: jest.fn(),
        },
      },
    };
  });

  test("should update identity", async () => {
    await expect(addUserinfoController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.identityRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        address: {
          careOf: null,
          country: "country",
          locality: "locality",
          postalCode: "postalCode",
          region: "region",
          streetAddress: ["streetAddress 1", "streetAddress 2"],
        },
        birthDate: "birthDate",
        displayName: {
          name: null,
          number: null,
        },
        familyName: "familyName",
        gender: "gender",
        givenName: "givenName",
        gravatarUri: null,
        locale: "locale",
        middleName: "middleName",
        namingSystem: "given_family",
        nickname: "nickname",
        picture: "picture",
        preferredUsername: "preferredUsername",
        profile: "profile",
        pronouns: null,
        username: null,
        website: "website",
        zoneInfo: "zoneInfo",
      }),
    );
  });
});
