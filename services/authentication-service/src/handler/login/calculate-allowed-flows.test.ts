import { Account, LoginSession } from "../../entity";
import { getTestAccount, getTestLoginSession } from "../../test/entity";
import { calculateAllowedFlows } from "./calculate-allowed-flows";

describe("calculateAllowedFlows", () => {
  let ctx: any;
  let loginSession: LoginSession;
  let account: Account;

  beforeEach(() => {
    ctx = {
      getCookie: jest.fn(),
    };

    loginSession = getTestLoginSession();
  });

  describe("with no amr values", () => {
    test("should resolve all basic flows", async () => {
      expect(calculateAllowedFlows(ctx, loginSession, account)).toStrictEqual([
        "bank_id_se",
        "device_challenge",
        "email_link",
        "email_otp",
        "password",
        "phone_otp",
        "rdc_qr_code",
        "session_accept_with_code",
        "webauthn",
      ]);
    });

    test("should resolve flows with cookies", async () => {
      ctx.getCookie.mockImplementation(() => "cookie");

      expect(calculateAllowedFlows(ctx, loginSession, account)).toStrictEqual(
        expect.arrayContaining(["password_browser_link"]),
      );
    });
  });

  describe("with one amr value", () => {
    test("should resolve all basic flows", async () => {
      loginSession = getTestLoginSession({
        amrValues: ["email_otp"],
        levelOfAssurance: 1,
      });

      expect(calculateAllowedFlows(ctx, loginSession, account)).toStrictEqual([
        "bank_id_se",
        "phone_otp",
        "rdc_qr_code",
        "session_accept_with_code",
        "session_otp",
        "webauthn",
      ]);
    });

    test("should resolve flows with cookies", async () => {
      loginSession = getTestLoginSession({
        amrValues: ["email_otp"],
        levelOfAssurance: 1,
      });

      ctx.getCookie.mockImplementation(() => "cookie");

      expect(calculateAllowedFlows(ctx, loginSession, account)).toStrictEqual(
        expect.arrayContaining(["mfa_cookie"]),
      );
    });
  });

  describe("with one amr value & account", () => {
    test("should resolve time based otp", async () => {
      loginSession = getTestLoginSession({
        amrValues: ["email_otp"],
        levelOfAssurance: 1,
      });

      account = getTestAccount();

      expect(calculateAllowedFlows(ctx, loginSession, account)).toStrictEqual(
        expect.arrayContaining(["time_based_otp"]),
      );
    });
  });
});
