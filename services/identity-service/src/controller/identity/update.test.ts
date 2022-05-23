import MockDate from "mockdate";
import { Scope } from "../../common";
import { getTestIdentity } from "../../test/entity";
import { identityUpdateController } from "./update";
import { logger } from "../../test/logger";
import { updateIdentityDisplayName as _updateIdentityDisplayName } from "../../handler";

MockDate.set("2020-01-01T08:00:00.000");

jest.mock("../../handler");

const updateIdentityDisplayName = _updateIdentityDisplayName as jest.Mock;

describe("identityUpdateController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        address: {
          country: "new-country",
          locality: "new-locality",
          postalCode: "new-postalCode",
          region: "new-region",
          streetAddress: ["new-streetAddress"],
        },
        birthDate: "new-birthDate",
        displayName: "new-displayName",
        familyName: "new-familyName",
        gender: "new-gender",
        givenName: "new-givenName",
        gravatarUri: "new-gravatar",
        locale: "new-locale",
        middleName: "new-middleName",
        namingSystem: "new-namingSystem",
        nationalIdentityNumber: "new-nationalIdentityNumber",
        nickname: "new-nickname",
        picture: "new-picture",
        preferredAccessibility: ["new-setting"],
        preferredUsername: "new-preferredUsername",
        profile: "new-profile",
        pronouns: "new-pronouns",
        socialSecurityNumber: "new-socialSecurityNumber",
        username: "new-username",
        website: "new-website",
        zoneInfo: "new-zoneInfo",
      },
      entity: {
        identity: getTestIdentity({
          id: "identityId",
        }),
      },
      logger,
      repository: {
        identityRepository: {
          update: jest.fn(),
        },
      },
      token: {
        bearerToken: {
          scopes: [
            Scope.ACCESSIBILITY,
            Scope.ADDRESS,
            Scope.CONNECTED_PROVIDERS,
            Scope.NATIONAL_IDENTITY_NUMBER,
            Scope.PROFILE,
            Scope.SOCIAL_SECURITY_NUMBER,
            Scope.USERNAME,
          ],
          subject: "identityId",
        },
      },
    };
  });

  test("should update identity", async () => {
    await expect(identityUpdateController(ctx)).resolves.toBeUndefined();

    expect(updateIdentityDisplayName).toHaveBeenCalled();
    expect(ctx.repository.identityRepository.update.mock.calls).toMatchSnapshot();
  });
});
