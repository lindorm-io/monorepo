import MockDate from "mockdate";
import { Scope } from "../../common";
import { createMockLogger } from "@lindorm-io/winston";
import { createTestIdentity } from "../../fixtures/entity";
import { updateIdentityController } from "./update-identity";
import { updateIdentityDisplayName as _updateIdentityDisplayName } from "../../handler";
import { createMockRepository } from "@lindorm-io/mongo";

MockDate.set("2020-01-01T08:00:00.000");

jest.mock("../../handler");

const updateIdentityDisplayName = _updateIdentityDisplayName as jest.Mock;

describe("updateIdentityController", () => {
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
        identity: createTestIdentity({
          id: "identityId",
        }),
      },
      logger: createMockLogger(),
      repository: {
        identityRepository: createMockRepository(createTestIdentity),
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
    await expect(updateIdentityController(ctx)).resolves.toBeUndefined();

    expect(updateIdentityDisplayName).toHaveBeenCalled();
    expect(ctx.repository.identityRepository.update.mock.calls).toMatchSnapshot();
  });
});
