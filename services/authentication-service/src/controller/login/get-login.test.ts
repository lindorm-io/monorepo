import { FlowType } from "../../enum";
import { getLoginController } from "./get-login";
import { getTestFlowSession, getTestLoginSession } from "../../test/entity";
import {
  getCurrentFlowSession as _getCurrentFlowSession,
  oauthConfirmAuthentication as _oauthConfirmAuthentication,
} from "../../handler";
import {
  getPrioritizedFlow as _getPrioritizedFlow,
  isAuthenticationReadyToConfirm as _isAuthenticationReadyToConfirm,
  isPollingRequired as _isPollingRequired,
} from "../../util";

jest.mock("../../handler");
jest.mock("../../util");

const oauthConfirmAuthentication = _oauthConfirmAuthentication as jest.Mock;
const getCurrentFlowSession = _getCurrentFlowSession as jest.Mock;

const getPrioritizedFlow = _getPrioritizedFlow as jest.Mock;
const isAuthenticationReadyToConfirm = _isAuthenticationReadyToConfirm as jest.Mock;
const isPollingRequired = _isPollingRequired as jest.Mock;

describe("getLoginController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        loginSession: getTestLoginSession({
          allowedFlows: [FlowType.EMAIL_OTP, FlowType.SESSION_OTP, FlowType.WEBAUTHN],
          allowedOidc: ["apple", "google"],
        }),
      },
      deleteCookie: jest.fn(),
    };

    oauthConfirmAuthentication.mockResolvedValue({
      redirectTo: "oauthConfirmAuthentication",
    });
    getCurrentFlowSession.mockResolvedValue(
      getTestFlowSession({ id: "209f419e-9674-4e76-8a8f-1f5a74f99e30" }),
    );

    getPrioritizedFlow.mockImplementation(() => "prioritized_flow");
    isAuthenticationReadyToConfirm.mockImplementation(() => false);
    isPollingRequired.mockImplementation(() => true);
  });

  afterEach(jest.resetAllMocks);

  test("should resolve info", async () => {
    await expect(getLoginController(ctx)).resolves.toMatchSnapshot();

    expect(oauthConfirmAuthentication).not.toHaveBeenCalled();
    expect(getCurrentFlowSession).toHaveBeenCalled();
  });

  test("should resolve redirect", async () => {
    isAuthenticationReadyToConfirm.mockImplementation(() => true);

    await expect(getLoginController(ctx)).resolves.toStrictEqual({
      redirect: "oauthConfirmAuthentication",
    });

    expect(oauthConfirmAuthentication).toHaveBeenCalled();
    expect(ctx.deleteCookie).toHaveBeenCalled();
    expect(getCurrentFlowSession).not.toHaveBeenCalled();
  });
});
