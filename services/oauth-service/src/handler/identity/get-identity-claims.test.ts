import { createMockRedisRepository } from "@lindorm-io/redis";
import { TEST_GET_USERINFO_RESPONSE } from "../../fixtures/data";
import {
  createTestClaimsSession,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";
import { generateServerBearerAuthMiddleware as _generateServerBearerAuthMiddleware } from "../token";
import { getIdentityClaims } from "./get-identity-claims";

jest.mock("../token");

const generateServerBearerAuthMiddleware = _generateServerBearerAuthMiddleware as jest.Mock;

describe("getIdentityClaims", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      axios: {
        axiosClient: {
          get: jest.fn().mockResolvedValue({
            data: {
              customThingOne: "custom_thing_one",
              customThingTwo: "custom_thing_two",
              customThingThree: { foo: "bar" },
            },
          }),
        },
        identityClient: {
          get: jest.fn().mockResolvedValue({
            data: TEST_GET_USERINFO_RESPONSE,
          }),
        },
      },
      redis: {
        claimsSessionCache: createMockRedisRepository(createTestClaimsSession),
      },
    };

    generateServerBearerAuthMiddleware.mockReturnValue("generateServerBearerAuthMiddleware");
  });

  test("should resolve", async () => {
    await expect(
      getIdentityClaims(ctx, createTestClient(), createTestClientSession()),
    ).resolves.toStrictEqual({
      active: true,
      address: {
        careOf: "careOf",
        country: "country",
        formatted: "streetAddress1\nstreetAddress2\npostalCode locality\nregion\ncountry",
        locality: "locality",
        postalCode: "postalCode",
        region: "region",
        streetAddress: "streetAddress1\nstreetAddress2",
      },
      avatarUri: "https://avatar.url/",
      birthDate: "2000-01-01",
      customThingOne: "custom_thing_one",
      customThingThree: {
        foo: "bar",
      },
      customThingTwo: "custom_thing_two",
      displayName: "displayName#8441",
      email: "test@lindorm.io",
      emailVerified: true,
      familyName: "familyName",
      gender: "gender",
      givenName: "givenName",
      locale: "sv-SE",
      middleName: "middleName",
      name: "givenName familyName",
      nationalIdentityNumber: "198056702895",
      nationalIdentityNumberVerified: true,
      nickname: "nickname",
      phoneNumber: "+46705498721",
      phoneNumberVerified: true,
      picture: "https://picture.url/",
      preferredAccessibility: ["setting1", "setting2", "setting3"],
      preferredUsername: "username",
      profile: "https://profile.url/",
      pronouns: "she/her",
      socialSecurityNumber: "198056702895",
      socialSecurityNumberVerified: false,
      sub: "d821cde6-250f-4918-ad55-877a7abf0271",
      updatedAt: 1609488000,
      username: "identityUsername",
      website: "https://website.url/",
      zoneInfo: "Europe/Stockholm",
    });

    expect(ctx.redis.claimsSessionCache.create).toHaveBeenCalled();
    expect(ctx.axios.identityClient.get).toHaveBeenCalled();
    expect(ctx.redis.claimsSessionCache.destroy).toHaveBeenCalled();
  });
});
