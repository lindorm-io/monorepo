import { Account, LoginSession, OidcSession } from "../../entity";
import { getAuthenticatedAccount } from "./get-authenticated-account";
import { logger } from "../../test/logger";
import { getTestAccount, getTestLoginSession, getTestOidcSession } from "../../test/entity";
import { findOrCreateAccount as _findOrCreateAccount } from "../account";
import {
  identityAuthenticateOidc as _identityAuthenticateOidc,
  identityUpdateUserinfo as _identityUpdateUserinfo,
} from "../axios";

jest.mock("../account");
jest.mock("../axios");

const findOrCreateAccount = _findOrCreateAccount as jest.Mock;
const identityAuthenticateOidc = _identityAuthenticateOidc as jest.Mock;
const identityUpdateUserinfo = _identityUpdateUserinfo as jest.Mock;

describe("getAuthenticatedAccount", () => {
  let ctx: any;
  let loginSession: LoginSession;
  let oidcSession: OidcSession;
  let options: any;

  beforeEach(() => {
    ctx = { logger };

    loginSession = getTestLoginSession();
    oidcSession = getTestOidcSession();

    options = {
      subject: "subject",
      claims: { claims: true },
    };

    findOrCreateAccount.mockImplementation(async (arg) => getTestAccount(arg));
    identityAuthenticateOidc.mockResolvedValue({ identityId: "identityId" });
  });

  test("should resolve", async () => {
    await expect(
      getAuthenticatedAccount(ctx, loginSession, oidcSession, options),
    ).resolves.toStrictEqual(expect.any(Account));

    expect(identityAuthenticateOidc).toHaveBeenCalled();
    expect(identityUpdateUserinfo).toHaveBeenCalled();
  });
});
