import { ClientError } from "@lindorm-io/errors";
import { FlowType } from "../../enum";
import { SessionStatus } from "../../common";
import { canFlowGenerateMfaCookie as _canFlowGenerateMfaCookie } from "../../util";
import { confirmFlowController } from "./confirm-flow";
import {
  confirmBankIdSeFlow as _confirmBankIdSeFlow,
  confirmPasswordFlow as _confirmPasswordFlow,
  generateMfaCookie as _generateMfaCookie,
  updateLoginSessionWithFlow as _updateLoginSessionWithFlow,
} from "../../handler";
import { getTestAccount, getTestFlowSession, getTestLoginSession } from "../../test/entity";

jest.mock("../../handler");
jest.mock("../../util");

const canFlowGenerateMfaCookie = _canFlowGenerateMfaCookie as jest.Mock;
const confirmBankIdSeFlow = _confirmBankIdSeFlow as jest.Mock;
const confirmPasswordFlow = _confirmPasswordFlow as jest.Mock;
const generateMfaCookie = _generateMfaCookie as jest.Mock;
const updateLoginSessionWithFlow = _updateLoginSessionWithFlow as jest.Mock;

describe("confirmFlow", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        flowSessionCache: {
          update: jest.fn().mockImplementation(async (arg) => arg),
        },
      },
      data: {
        challengeConfirmationToken: "challengeConfirmationToken",
        code: "code",
        otp: "otp",
        password: "password",
        totp: "totp",
      },
      entity: {
        loginSession: getTestLoginSession({
          identityId: "aeaec2bd-897b-4b74-bca0-db2559853ce1",
        }),
        flowSession: getTestFlowSession({
          type: FlowType.BANK_ID_SE,
        }),
      },
    };

    canFlowGenerateMfaCookie.mockImplementation(() => true);
    confirmBankIdSeFlow.mockResolvedValue(
      getTestAccount({
        id: "aeaec2bd-897b-4b74-bca0-db2559853ce1",
      }),
    );
    confirmPasswordFlow.mockResolvedValue(
      getTestAccount({
        id: "aeaec2bd-897b-4b74-bca0-db2559853ce1",
      }),
    );
    updateLoginSessionWithFlow.mockImplementation((_1, _2, arg, _3) => arg);
  });

  afterEach(jest.resetAllMocks);

  test("should resolve Bank ID", async () => {
    await expect(confirmFlowController(ctx)).resolves.toBeUndefined();

    expect(confirmBankIdSeFlow).toHaveBeenCalled();
    expect(confirmPasswordFlow).not.toHaveBeenCalled();
    expect(ctx.cache.flowSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: SessionStatus.CONFIRMED,
      }),
    );
    expect(generateMfaCookie).toHaveBeenCalled();
  });

  test("should resolve Password", async () => {
    ctx.entity.flowSession = getTestFlowSession({
      type: FlowType.PASSWORD,
    });

    await expect(confirmFlowController(ctx)).resolves.toBeUndefined();

    expect(confirmPasswordFlow).toHaveBeenCalled();
    expect(confirmBankIdSeFlow).not.toHaveBeenCalled();
  });

  test("should not generate mfa cookie", async () => {
    canFlowGenerateMfaCookie.mockImplementation(() => false);

    await expect(confirmFlowController(ctx)).resolves.toBeUndefined();

    expect(generateMfaCookie).not.toHaveBeenCalled();
  });

  test("should throw on invalid account id", async () => {
    confirmBankIdSeFlow.mockResolvedValue(
      getTestAccount({
        id: "dea98c3e-6048-4d78-9c22-dca901f7b31e",
      }),
    );

    await expect(confirmFlowController(ctx)).rejects.toThrow(ClientError);
  });
});
