import { Scope } from "@lindorm-io/common-enums";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import MockDate from "mockdate";
import { createTestAddress, createTestIdentity } from "../../fixtures/entity";
import { getIdentifierClaims as _getIdentifierClaims } from "../../handler";
import {
  getAddress as _getAddress,
  getDisplayName as _getDisplayName,
  getName as _getName,
} from "../../util";
import { getUserinfoController } from "./get-userinfo";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../handler");
jest.mock("../../util");

const getAddress = _getAddress as jest.Mock;
const getDisplayName = _getDisplayName as jest.Mock;
const getIdentifierClaims = _getIdentifierClaims as jest.Mock;
const getName = _getName as jest.Mock;

describe("getUserinfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        identity: createTestIdentity({
          id: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
          updated: new Date("2020-08-08T08:00:00.000Z"),
          username: "bFp3ihd84Ps8Ocjf",
        }),
      },
      mongo: {
        addressRepository: createMockMongoRepository(createTestAddress),
      },
      token: {
        bearerToken: {
          metadata: { scopes: [Scope.OPENID] },
        },
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
  });

  test("should resolve with basic userinfo", async () => {
    await expect(getUserinfoController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        sub: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        updatedAt: 1596873600,
      },
    });
  });

  test("should resolve ADDRESS", async () => {
    ctx.token.bearerToken.metadata.scopes.push(Scope.ADDRESS);

    await expect(getUserinfoController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        address: "getAddress",
        sub: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        updatedAt: 1596873600,
      },
    });
  });

  test("should resolve EMAIL", async () => {
    ctx.token.bearerToken.metadata.scopes.push(Scope.EMAIL);

    await expect(getUserinfoController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        email: "email",
        emailVerified: true,
        sub: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        updatedAt: 1596873600,
      },
    });
  });

  test("should resolve PHONE", async () => {
    ctx.token.bearerToken.metadata.scopes.push(Scope.PHONE);

    await expect(getUserinfoController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        phoneNumber: "phone",
        phoneNumberVerified: false,
        sub: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        updatedAt: 1596873600,
      },
    });
  });

  test("should resolve PROFILE", async () => {
    ctx.token.bearerToken.metadata.scopes.push(Scope.PROFILE);

    await expect(getUserinfoController(ctx)).resolves.toStrictEqual({
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
        updatedAt: 1596873600,
        website: "https://website.url/",
        zoneInfo: "Europe/Stockholm",
      },
    });
  });

  test("should resolve ACCESSIBILITY", async () => {
    ctx.token.bearerToken.metadata.scopes.push(Scope.ACCESSIBILITY);

    await expect(getUserinfoController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        preferredAccessibility: ["setting1", "setting2", "setting3"],
        sub: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        updatedAt: 1596873600,
      },
    });
  });

  test("should resolve NATIONAL_IDENTITY_NUMBER", async () => {
    ctx.token.bearerToken.metadata.scopes.push(Scope.NATIONAL_IDENTITY_NUMBER);

    await expect(getUserinfoController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        nationalIdentityNumber: "619492152033",
        nationalIdentityNumberVerified: false,
        sub: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        updatedAt: 1596873600,
      },
    });
  });

  test("should resolve PUBLIC", async () => {
    ctx.token.bearerToken.metadata.scopes.push(Scope.PUBLIC);

    await expect(getUserinfoController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        displayName: "getDisplayName",
        avatarUri: "https://avatar.url/",
        pronouns: "she/her",
        sub: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        updatedAt: 1596873600,
      },
    });
  });

  test("should resolve SOCIAL_SECURITY_NUMBER", async () => {
    ctx.token.bearerToken.metadata.scopes.push(Scope.SOCIAL_SECURITY_NUMBER);

    await expect(getUserinfoController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        socialSecurityNumber: "279708557743",
        socialSecurityNumberVerified: false,
        sub: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        updatedAt: 1596873600,
      },
    });
  });

  test("should resolve USERNAME", async () => {
    ctx.token.bearerToken.metadata.scopes.push(Scope.USERNAME);

    await expect(getUserinfoController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        sub: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
        updatedAt: 1596873600,
        username: "bFp3ihd84Ps8Ocjf",
      },
    });
  });
});
