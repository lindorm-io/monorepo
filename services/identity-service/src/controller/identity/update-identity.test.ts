import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { createTestIdentity } from "../../fixtures/entity";
import { updateIdentityDisplayName as _updateIdentityDisplayName } from "../../handler";
import { updateIdentityController } from "./update-identity";

MockDate.set("2020-01-01T08:00:00.000");

jest.mock("../../handler");

const updateIdentityDisplayName = _updateIdentityDisplayName as jest.Mock;

describe("updateIdentityController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        active: false,
        birthDate: "new-birthDate",
        displayName: "new-displayName",
        familyName: "new-familyName",
        gender: "new-gender",
        givenName: "new-givenName",
        avatarUri: "new-avatar",
        locale: "new-locale",
        middleName: "new-middleName",
        namingSystem: "new-namingSystem",
        nickname: "new-nickname",
        picture: "new-picture",
        preferredAccessibility: ["new-setting"],
        profile: "new-profile",
        pronouns: "new-pronouns",
        preferredName: "new-preferredName",
        website: "new-website",
        zoneInfo: "new-zoneInfo",
      },
      entity: {
        identity: createTestIdentity(),
      },
      mongo: {
        identityRepository: createMockMongoRepository(createTestIdentity),
      },
    };

    updateIdentityDisplayName.mockImplementation(async (_, identity, displayName) => {
      identity.displayName.name = displayName;
      identity.displayName.number = 9999;

      return identity;
    });
  });

  test("should update identity", async () => {
    await expect(updateIdentityController(ctx)).resolves.toBeUndefined();

    expect(updateIdentityDisplayName).toHaveBeenCalled();
    expect(ctx.mongo.identityRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        active: false,
        avatarUri: "new-avatar",
        birthDate: "new-birthDate",
        displayName: {
          name: "new-displayName",
          number: 9999,
        },
        familyName: "new-familyName",
        gender: "new-gender",
        givenName: "new-givenName",
        locale: "new-locale",
        middleName: "new-middleName",
        namingSystem: "new-namingSystem",
        nickname: "new-nickname",
        picture: "new-picture",
        preferredAccessibility: ["new-setting"],
        preferredName: "new-preferredName",
        profile: "new-profile",
        pronouns: "new-pronouns",
        website: "new-website",
        zoneInfo: "new-zoneInfo",
      }),
    );
  });
});
