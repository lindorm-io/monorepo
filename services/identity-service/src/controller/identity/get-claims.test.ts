import { Scope } from "@lindorm-io/common-enums";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { createTestAddress, createTestIdentity } from "../../fixtures/entity";
import {
  getIdentifierClaims as _getIdentifierClaims,
  getOauthClaimsSession as _getOauthClaimsSession,
} from "../../handler";
import {
  getAddress as _getAddress,
  getDisplayName as _getDisplayName,
  getName as _getName,
} from "../../util";
import { getClaimsController } from "./get-claims";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");
jest.mock("../../util");

const getAddress = _getAddress as jest.Mock;
const getDisplayName = _getDisplayName as jest.Mock;
const getIdentifierClaims = _getIdentifierClaims as jest.Mock;
const getName = _getName as jest.Mock;
const getOauthClaimsSession = _getOauthClaimsSession as jest.Mock;

describe("getClaimsController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        session: "bda47dd1-c5a8-4434-aa51-1ed1ae337685",
      },
      mongo: {
        addressRepository: createMockMongoRepository(createTestAddress),
        identityRepository: createMockMongoRepository(createTestIdentity),
      },
    };

    getAddress.mockReturnValue("getAddress");
    getDisplayName.mockReturnValue("getDisplayName");
    getIdentifierClaims.mockResolvedValue({
      email: "email",
      emailVerified: true,
      nationalIdentityNumber: "619492152033",
      nationalIdentityNumberVerified: false,
      phoneNumber: "phone",
      phoneNumberVerified: false,
      socialSecurityNumber: "279708557743",
      socialSecurityNumberVerified: false,
    });
    getName.mockReturnValue("getName");
    getOauthClaimsSession.mockResolvedValue({
      claimsSession: {
        identityId: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        scopes: [Scope.OPENID],
      },
    });
  });

  test("should resolve with basic userinfo", async () => {
    await expect(getClaimsController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        sub: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        updatedAt: 1609488000,
      },
    });
  });

  test("should resolve ADDRESS", async () => {
    getOauthClaimsSession.mockResolvedValue({
      claimsSession: {
        identityId: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        scopes: [Scope.OPENID, Scope.ADDRESS],
      },
    });

    await expect(getClaimsController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        address: "getAddress",
        sub: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        updatedAt: 1609488000,
      },
    });
  });

  test("should resolve EMAIL", async () => {
    getOauthClaimsSession.mockResolvedValue({
      claimsSession: {
        identityId: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        scopes: [Scope.OPENID, Scope.EMAIL],
      },
    });

    await expect(getClaimsController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        email: "email",
        emailVerified: true,
        sub: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        updatedAt: 1609488000,
      },
    });
  });

  test("should resolve PHONE", async () => {
    getOauthClaimsSession.mockResolvedValue({
      claimsSession: {
        identityId: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        scopes: [Scope.OPENID, Scope.PHONE],
      },
    });

    await expect(getClaimsController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        phoneNumber: "phone",
        phoneNumberVerified: false,
        sub: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        updatedAt: 1609488000,
      },
    });
  });

  test("should resolve PROFILE", async () => {
    getOauthClaimsSession.mockResolvedValue({
      claimsSession: {
        identityId: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        scopes: [Scope.OPENID, Scope.PROFILE],
      },
    });

    await expect(getClaimsController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        birthDate: "2000-01-01",
        familyName: "Torsson",
        gender: "Female",
        givenName: "Oliver",
        locale: "sv-SE",
        maritalStatus: "Single",
        middleName: "Rio",
        name: "getName",
        nickname: "Wheat",
        picture: "https://picture.url/",
        preferredUsername: "rio_wheat",
        profile: "https://profile.url/",
        sub: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        preferredName: "Olivia",
        updatedAt: 1609488000,
        website: "https://website.url/",
        zoneInfo: "Europe/Stockholm",
      },
    });
  });

  test("should resolve ACCESSIBILITY", async () => {
    getOauthClaimsSession.mockResolvedValue({
      claimsSession: {
        identityId: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        scopes: [Scope.OPENID, Scope.ACCESSIBILITY],
      },
    });

    await expect(getClaimsController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        preferredAccessibility: ["setting1", "setting2", "setting3"],
        sub: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        updatedAt: 1609488000,
      },
    });
  });

  test("should resolve NATIONAL_IDENTITY_NUMBER", async () => {
    getOauthClaimsSession.mockResolvedValue({
      claimsSession: {
        identityId: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        scopes: [Scope.OPENID, Scope.NATIONAL_IDENTITY_NUMBER],
      },
    });

    await expect(getClaimsController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        nationalIdentityNumber: "619492152033",
        nationalIdentityNumberVerified: false,
        sub: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        updatedAt: 1609488000,
      },
    });
  });

  test("should resolve PUBLIC", async () => {
    getOauthClaimsSession.mockResolvedValue({
      claimsSession: {
        identityId: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        scopes: [Scope.OPENID, Scope.PUBLIC],
      },
    });

    await expect(getClaimsController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        displayName: "getDisplayName",
        avatarUri: "https://avatar.url/",
        pronouns: "she/her",
        sub: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        updatedAt: 1609488000,
      },
    });
  });

  test("should resolve SOCIAL_SECURITY_NUMBER", async () => {
    getOauthClaimsSession.mockResolvedValue({
      claimsSession: {
        identityId: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        scopes: [Scope.OPENID, Scope.SOCIAL_SECURITY_NUMBER],
      },
    });

    await expect(getClaimsController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        socialSecurityNumber: "279708557743",
        socialSecurityNumberVerified: false,
        sub: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        updatedAt: 1609488000,
      },
    });
  });

  test("should resolve USERNAME", async () => {
    getOauthClaimsSession.mockResolvedValue({
      claimsSession: {
        identityId: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        scopes: [Scope.OPENID, Scope.USERNAME],
      },
    });

    await expect(getClaimsController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        sub: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        updatedAt: 1609488000,
        username: expect.any(String),
      },
    });
  });
});
