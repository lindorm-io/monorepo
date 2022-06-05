import { Identity } from "../../entity";
import { Scope } from "../../common";
import { getConnectedProviders as _getConnectedProviders } from "../external";
import { createTestIdentity } from "../../fixtures/entity";
import { getUserinfoResponseBody } from "./get-userinfo-response-body";
import { userinfoEmailGet as _userinfoEmailGet } from "../email";
import { userinfoPhoneNumberGet as _userinfoPhoneNumberGet } from "../phone-number";
import {
  getAddress as _getAddress,
  getDisplayName as _getDisplayName,
  getName as _getName,
} from "../../util";

jest.mock("../../util");
jest.mock("../email");
jest.mock("../external");
jest.mock("../phone-number");

const getAddress = _getAddress as jest.Mock;
const getConnectedProviders = _getConnectedProviders as jest.Mock;
const getDisplayName = _getDisplayName as jest.Mock;
const getName = _getName as jest.Mock;
const userinfoEmailGet = _userinfoEmailGet as jest.Mock;
const userinfoPhoneNumberGet = _userinfoPhoneNumberGet as jest.Mock;

describe("getUserinfoResponseBody", () => {
  let ctx: any;
  let identity: Identity;
  let scopes: Array<Scope>;

  beforeEach(() => {
    ctx = {};
    identity = createTestIdentity({
      id: "785ca3ef-c68b-4db9-a4a5-9fbbd9fca40f",
      nationalIdentityNumber: "619492152033",
      socialSecurityNumber: "279708557743",
      updated: new Date("2020-08-08T08:00:00.000Z"),
      username: "bFp3ihd84Ps8Ocjf",
    });
    scopes = [Scope.OPENID];

    getAddress.mockImplementation(() => "getAddress");
    getConnectedProviders.mockResolvedValue("getConnectedProviders");
    getDisplayName.mockImplementation(() => "getDisplayName");
    getName.mockImplementation(() => "getName");
    userinfoEmailGet.mockResolvedValue("userinfoEmailGet");
    userinfoPhoneNumberGet.mockResolvedValue("userinfoPhoneNumberGet");
  });

  test("should resolve basic data", async () => {
    await expect(getUserinfoResponseBody(ctx, identity, scopes)).resolves.toMatchSnapshot();
  });

  test("should resolve ACCESSIBILITY", async () => {
    scopes.push(Scope.ACCESSIBILITY);

    await expect(getUserinfoResponseBody(ctx, identity, scopes)).resolves.toMatchSnapshot();
  });

  test("should resolve ADDRESS", async () => {
    scopes.push(Scope.ADDRESS);

    await expect(getUserinfoResponseBody(ctx, identity, scopes)).resolves.toMatchSnapshot();
  });

  test("should resolve CONNECTED_PROVIDERS", async () => {
    scopes.push(Scope.CONNECTED_PROVIDERS);

    await expect(getUserinfoResponseBody(ctx, identity, scopes)).resolves.toMatchSnapshot();
  });

  test("should resolve EMAIL", async () => {
    scopes.push(Scope.EMAIL);

    await expect(getUserinfoResponseBody(ctx, identity, scopes)).resolves.toMatchSnapshot();
  });

  test("should resolve NATIONAL_IDENTITY_NUMBER", async () => {
    scopes.push(Scope.NATIONAL_IDENTITY_NUMBER);

    await expect(getUserinfoResponseBody(ctx, identity, scopes)).resolves.toMatchSnapshot();
  });

  test("should resolve PHONE", async () => {
    scopes.push(Scope.PHONE);

    await expect(getUserinfoResponseBody(ctx, identity, scopes)).resolves.toMatchSnapshot();
  });

  test("should resolve PROFILE", async () => {
    scopes.push(Scope.PROFILE);

    await expect(getUserinfoResponseBody(ctx, identity, scopes)).resolves.toMatchSnapshot();
  });

  test("should resolve SOCIAL_SECURITY_NUMBER", async () => {
    scopes.push(Scope.SOCIAL_SECURITY_NUMBER);

    await expect(getUserinfoResponseBody(ctx, identity, scopes)).resolves.toMatchSnapshot();
  });

  test("should resolve USERNAME", async () => {
    scopes.push(Scope.USERNAME);

    await expect(getUserinfoResponseBody(ctx, identity, scopes)).resolves.toMatchSnapshot();
  });
});
