import { TEST_GET_USERINFO_RESPONSE } from "../../fixtures/data";
import { getIdentityClaims } from "./get-identity-claims";
import { createMockCache } from "@lindorm-io/redis";
import { generateServerCredentialsJwt as _generateServerCredentialsToken } from "../token";
import {
  createTestClaimsSession,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";

jest.mock("../token");

const generateServerCredentialsToken = _generateServerCredentialsToken as jest.Mock;

describe("getIdentityClaims", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      axios: {
        axiosClient: {
          get: jest.fn().mockResolvedValue({
            data: { clientClaim: "clientClaim" },
          }),
        },
        identityClient: {
          get: jest.fn().mockResolvedValue({
            data: TEST_GET_USERINFO_RESPONSE,
          }),
        },
      },
      cache: {
        claimsSessionCache: createMockCache(createTestClaimsSession),
      },
    };

    generateServerCredentialsToken.mockImplementation(() => "bearerToken");
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
      clientClaim: "clientClaim",
      displayName: "displayName#8441",
      email: "test@lindorm.io",
      emailVerified: true,
      familyName: "familyName",
      gender: "gender",
      givenName: "givenName",
      locale: "sv-SE",
      middleName: "middleName",
      name: "givenName familyName",
      nickname: "nickname",
      phoneNumber: "+46705498721",
      phoneNumberVerified: true,
      picture: "https://picture.url/",
      preferredAccessibility: ["setting1", "setting2", "setting3"],
      preferredUsername: "username",
      profile: "https://profile.url/",
      pronouns: "she/her",
      socialSecurityNumber: "198056702895",
      sub: "d821cde6-250f-4918-ad55-877a7abf0271",
      updatedAt: 1609488000,
      username: "identityUsername",
      website: "https://website.url/",
      zoneInfo: "Europe/Stockholm",
    });

    expect(ctx.cache.claimsSessionCache.create).toHaveBeenCalled();
    expect(ctx.axios.axiosClient.get).toHaveBeenCalled();
    expect(ctx.axios.identityClient.get).toHaveBeenCalled();
    expect(ctx.cache.claimsSessionCache.destroy).toHaveBeenCalled();
  });
});
