import { Identity } from "../../entity";
import { addUserinfoController } from "./add-userinfo";
import { createMockLogger } from "@lindorm-io/winston";
import { createMockRepository } from "@lindorm-io/mongo";

jest.mock("../../handler");

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
      logger: createMockLogger(),
      repository: {
        identityRepository: createMockRepository(),
      },
    };
  });

  test("should update identity", async () => {
    await expect(addUserinfoController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.identityRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        active: true,
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
        nationalIdentityNumber: null,
        nationalIdentityNumberVerified: false,
        nickname: "nickname",
        picture: "picture",
        preferredAccessibility: [],
        preferredUsername: "preferredUsername",
        profile: "profile",
        pronouns: null,
        socialSecurityNumber: null,
        socialSecurityNumberVerified: false,
        username: "preferredUsername",
        website: "website",
        zoneInfo: "zoneInfo",
      }),
    );
  });
});
