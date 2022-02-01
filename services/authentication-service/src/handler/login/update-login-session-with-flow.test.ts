import { Account, FlowSession, LoginSession } from "../../entity";
import { updateLoginSessionWithFlow } from "./update-login-session-with-flow";
import { resolveAllowedFlows as _resolveAllowedFlows } from "./resolve-allowed-flows";
import { calculateLevelOfAssurance as _calculateLevelOfAssurance } from "../../util";
import { getTestAccount, getTestFlowSession, getTestLoginSession } from "../../test/entity";

jest.mock("../../util");
jest.mock("./resolve-allowed-flows");

const calculateLevelOfAssurance = _calculateLevelOfAssurance as jest.Mock;
const resolveAllowedFlows = _resolveAllowedFlows as jest.Mock;

describe("updateLoginSessionWithFlow", () => {
  let ctx: any;
  let account: Account;
  let loginSession: LoginSession;
  let flowSession: FlowSession;

  beforeEach(() => {
    ctx = {
      cache: {
        loginSessionCache: {
          update: jest.fn().mockImplementation((item) => item),
        },
      },
    };

    account = getTestAccount({
      id: "e917469f-a4dc-4886-b7f5-aa8d49809907",
    });

    loginSession = getTestLoginSession({
      identityId: null,
    });

    flowSession = getTestFlowSession();

    calculateLevelOfAssurance.mockImplementation(() => 3);
    resolveAllowedFlows.mockImplementation(async (_1, arg) => arg);
  });

  test("should resolve", async () => {
    await expect(
      updateLoginSessionWithFlow(ctx, account, loginSession, flowSession),
    ).resolves.toStrictEqual(
      expect.objectContaining({
        amrValues: ["email_otp"],
        identityId: "e917469f-a4dc-4886-b7f5-aa8d49809907",
        levelOfAssurance: 3,
      }),
    );
  });
});
