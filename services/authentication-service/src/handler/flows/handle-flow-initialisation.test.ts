import { FlowType } from "../../enum";
import { LoginSession } from "../../entity";
import { getTestLoginSession } from "../../test/entity";
import { handleFlowInitialisation } from "./handle-flow-initialisation";
import {
  isPollingRequired as _isPollingRequired,
  isTokenReturned as _isTokenReturned,
} from "../../util";
import {
  initialiseBankIdSeFlow as _initialiseBankIdSeFlow,
  initialiseTimeBasedOtpFlow as _initialiseTimeBasedOtpFlow,
} from "../../handler";

jest.mock("../../handler");
jest.mock("../../util");

const isPollingRequired = _isPollingRequired as jest.Mock;
const isTokenReturned = _isTokenReturned as jest.Mock;
const initialiseBankIdSeFlow = _initialiseBankIdSeFlow as jest.Mock;
const initialiseTimeBasedOtpFlow = _initialiseTimeBasedOtpFlow as jest.Mock;

describe("handleFlowInitialisation", () => {
  let ctx: any;
  let loginSession: LoginSession;
  let options: any;

  beforeEach(() => {
    ctx = {
      cache: {
        flowSessionCache: {
          create: jest.fn().mockImplementation(async (arg) => ({ ...arg, id: "id" })),
        },
      },
      jwt: {
        sign: jest.fn().mockImplementation(() => ({ token: "jwt.jwt.jwt" })),
      },
    };

    loginSession = getTestLoginSession();

    options = {
      email: "email",
      flowType: FlowType.BANK_ID_SE,
      nonce: "nonce",
      phoneNumber: "phoneNumber",
      username: "username",
    };

    isPollingRequired.mockImplementation(() => true);
    isTokenReturned.mockImplementation(() => true);
    initialiseBankIdSeFlow.mockResolvedValue({ extra: "value" });
    initialiseTimeBasedOtpFlow.mockResolvedValue(undefined);
  });

  afterEach(jest.resetAllMocks);

  test("should resolve Bank ID", async () => {
    await expect(handleFlowInitialisation(ctx, loginSession, options)).resolves.toStrictEqual({
      extra: "value",
      flowToken: "jwt.jwt.jwt",
      id: "id",
      pollingRequired: true,
    });

    expect(initialiseBankIdSeFlow).toHaveBeenCalled();
    expect(initialiseTimeBasedOtpFlow).not.toHaveBeenCalled();
  });

  test("should resolve TOTP", async () => {
    options.flowType = FlowType.TIME_BASED_OTP;

    await expect(handleFlowInitialisation(ctx, loginSession, options)).resolves.toStrictEqual({
      flowToken: "jwt.jwt.jwt",
      id: "id",
      pollingRequired: true,
    });

    expect(initialiseTimeBasedOtpFlow).toHaveBeenCalled();
    expect(initialiseBankIdSeFlow).not.toHaveBeenCalled();
  });
});
