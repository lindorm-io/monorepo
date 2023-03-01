import { Identity } from "../../entity";
import { addUserinfoController } from "./add-userinfo";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestIdentity } from "../../fixtures/entity";
import {
  addAddressFromUserinfo as _addAddressFromUserinfo,
  addGenericIdentifier as _addGenericIdentifier,
} from "../../handler";

jest.mock("../../handler");

const addAddressFromUserinfo = _addAddressFromUserinfo as jest.Mock;
const addGenericIdentifier = _addGenericIdentifier as jest.Mock;

describe("addUserinfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        provider: "provider",
        sub: "sub",
        updatedAt: "updatedAt",

        address: {
          country: "country",
          locality: "locality",
          postalCode: "postalCode",
          region: "region",
          streetAddress: "streetAddress 1\nstreetAddress 2",
        },
        birthDate: "added-birthDate",
        email: "added-email",
        emailVerified: true,
        familyName: "added-familyName",
        gender: "added-gender",
        givenName: "added-givenName",
        locale: "added-locale",
        middleName: "added-middleName",
        nickname: "added-nickname",
        phoneNumber: "added-phoneNumber",
        phoneNumberVerified: true,
        picture: "added-picture",
        preferredUsername: "added-preferredUsername",
        profile: "added-profile",
        website: "added-website",
        zoneInfo: "added-zoneInfo",
      },
      entity: {
        identity: new Identity({}),
      },
      repository: {
        identityRepository: createMockRepository(createTestIdentity),
      },
    };
  });

  test("should update identity", async () => {
    await expect(addUserinfoController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.identityRepository.update).toHaveBeenCalledTimes(2);

    expect(addAddressFromUserinfo).toHaveBeenCalled();
    expect(addGenericIdentifier).toHaveBeenCalledTimes(3);
  });
});
