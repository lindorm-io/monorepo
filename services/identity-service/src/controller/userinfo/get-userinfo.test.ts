import { LindormScopes } from "@lindorm-io/common-types";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestAddress, createTestIdentity } from "../../fixtures/entity";
import { getIdentifierUserinfo as _getIdentifierUserinfo } from "../../handler";
import { getUserinfoController } from "./get-userinfo";
import {
  getAddress as _getAddress,
  getDisplayName as _getDisplayName,
  getName as _getName,
} from "../../util";

jest.mock("../../handler");
jest.mock("../../util");

const getAddress = _getAddress as jest.Mock;
const getDisplayName = _getDisplayName as jest.Mock;
const getIdentifierUserinfo = _getIdentifierUserinfo as jest.Mock;
const getName = _getName as jest.Mock;

describe("getUserinfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        identity: createTestIdentity({
          id: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
          nationalIdentityNumber: "619492152033",
          socialSecurityNumber: "279708557743",
          updated: new Date("2020-08-08T08:00:00.000Z"),
          username: "bFp3ihd84Ps8Ocjf",
        }),
      },
      repository: {
        addressRepository: createMockRepository(createTestAddress),
      },
      token: {
        bearerToken: {
          scopes: [LindormScopes.OPENID, LindormScopes.EMAIL],
        },
      },
    };

    getAddress.mockImplementation(() => "getAddress");
    getDisplayName.mockImplementation(() => "getDisplayName");
    getIdentifierUserinfo.mockResolvedValue({
      connectedProviders: ["provider"],
      email: "email",
      emailVerified: true,
      phoneNumber: "phone",
      phoneNumberVerified: false,
    });
    getName.mockImplementation(() => "getName");
  });

  test("should resolve with basic userinfo", async () => {
    await expect(getUserinfoController(ctx)).resolves.toMatchSnapshot();
  });

  test("should resolve ACCESSIBILITY", async () => {
    ctx.token.bearerToken.scopes.push(LindormScopes.ACCESSIBILITY);

    await expect(getUserinfoController(ctx)).resolves.toMatchSnapshot();
  });

  test("should resolve ADDRESS", async () => {
    ctx.token.bearerToken.scopes.push(LindormScopes.ADDRESS);

    await expect(getUserinfoController(ctx)).resolves.toMatchSnapshot();
  });

  test("should resolve CONNECTED_PROVIDERS", async () => {
    ctx.token.bearerToken.scopes.push(LindormScopes.CONNECTED_PROVIDERS);

    await expect(getUserinfoController(ctx)).resolves.toMatchSnapshot();
  });

  test("should resolve EMAIL", async () => {
    ctx.token.bearerToken.scopes.push(LindormScopes.EMAIL);

    await expect(getUserinfoController(ctx)).resolves.toMatchSnapshot();
  });

  test("should resolve NATIONAL_IDENTITY_NUMBER", async () => {
    ctx.token.bearerToken.scopes.push(LindormScopes.NATIONAL_IDENTITY_NUMBER);

    await expect(getUserinfoController(ctx)).resolves.toMatchSnapshot();
  });

  test("should resolve PHONE", async () => {
    ctx.token.bearerToken.scopes.push(LindormScopes.PHONE);

    await expect(getUserinfoController(ctx)).resolves.toMatchSnapshot();
  });

  test("should resolve PROFILE", async () => {
    ctx.token.bearerToken.scopes.push(LindormScopes.PROFILE);

    await expect(getUserinfoController(ctx)).resolves.toMatchSnapshot();
  });

  test("should resolve PUBLIC", async () => {
    ctx.token.bearerToken.scopes.push(LindormScopes.PUBLIC);

    await expect(getUserinfoController(ctx)).resolves.toMatchSnapshot();
  });

  test("should resolve SOCIAL_SECURITY_NUMBER", async () => {
    ctx.token.bearerToken.scopes.push(LindormScopes.SOCIAL_SECURITY_NUMBER);

    await expect(getUserinfoController(ctx)).resolves.toMatchSnapshot();
  });

  test("should resolve USERNAME", async () => {
    ctx.token.bearerToken.scopes.push(LindormScopes.USERNAME);

    await expect(getUserinfoController(ctx)).resolves.toMatchSnapshot();
  });
});
