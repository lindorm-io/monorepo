import { TEST_GET_USERINFO_RESPONSE } from "../../fixtures/data";
import { createTestAccessToken, createTestClientSession } from "../../fixtures/entity";
import {
  convertOpaqueTokenToJwt as _convertOpaqueTokenToJwt,
  getIdentityUserinfo as _getIdentityUserinfo,
} from "../../handler";
import { userinfoController } from "./userinfo";

jest.mock("../../handler");

const convertOpaqueTokenToJwt = _convertOpaqueTokenToJwt as jest.Mock;
const getIdentityUserinfo = _getIdentityUserinfo as jest.Mock;

describe("userinfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        clientSession: createTestClientSession(),
        opaqueToken: createTestAccessToken(),
      },
      token: { bearerToken: { token: "opaque" } },
    };

    convertOpaqueTokenToJwt.mockImplementation(() => ({ token: "jwt.jwt.jwt", expiresIn: 999 }));
    getIdentityUserinfo.mockResolvedValue(TEST_GET_USERINFO_RESPONSE);
  });

  afterEach(jest.resetAllMocks);

  test("should resolve user info", async () => {
    await expect(userinfoController(ctx)).resolves.toStrictEqual({
      body: {
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
        birthDate: "2000-01-01",
        displayName: "displayName#8441",
        email: "test@lindorm.io",
        emailVerified: true,
        familyName: "familyName",
        gender: "gender",
        givenName: "givenName",
        avatarUri: "https://avatar.url/",
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
      },
    });
  });
});
