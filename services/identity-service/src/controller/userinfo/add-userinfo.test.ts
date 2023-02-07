import { Identity } from "../../entity";
import { putUserinfoController } from "./add-userinfo";
import { createMockLogger } from "@lindorm-io/winston";
import { createMockRepository } from "@lindorm-io/mongo";
import {
  addAddressFromUserinfo as _addAddressFromUserinfo,
  addIdentifierFromUserinfo as _addIdentifierFromUserinfo,
} from "../../handler";

jest.mock("../../handler");

const addAddressFromUserinfo = _addAddressFromUserinfo as jest.Mock;
const addIdentifierFromUserinfo = _addIdentifierFromUserinfo as jest.Mock;

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
    await expect(putUserinfoController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.identityRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        active: true,
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

    expect(addAddressFromUserinfo).toHaveBeenCalled();
    expect(addIdentifierFromUserinfo).toHaveBeenCalledTimes(3);
  });
});
