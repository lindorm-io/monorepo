import { createLoginSessionController } from "./create-login-session";
import { getTestAccount } from "../../test/entity";
import {
  handleFlowInitialisation as _handleFlowInitialisation,
  resolveAllowedFlows as _resolveAllowedFlows,
} from "../../handler";

jest.mock("../../handler");

const handleFlowInitialisation = _handleFlowInitialisation as jest.Mock;
const resolveAllowedFlows = _resolveAllowedFlows as jest.Mock;

describe("createLoginSessionController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        loginSessionCache: {
          create: jest.fn().mockImplementation(async (arg) => arg),
        },
      },
      data: {
        country: "country",
        email: "email",
        flowType: "flowType",
        identityId: "identityId",
        nonce: "nonce",
        phoneNumber: "phoneNumber",
        pkceChallenge: "pkceChallenge",
        pkceMethod: "pkceMethod",
        username: "username",
      },
      repository: {
        accountRepository: {
          tryFind: jest.fn().mockResolvedValue(getTestAccount()),
        },
      },
    };

    handleFlowInitialisation.mockResolvedValue("flow");
    resolveAllowedFlows.mockImplementation(async (_1, _2, arg) => ({ ...arg, id: "id" }));
  });

  afterEach(jest.resetAllMocks);

  test("should resolve", async () => {
    await expect(createLoginSessionController(ctx)).resolves.toStrictEqual({
      body: { flow: "flow", id: "id" },
    });

    expect(handleFlowInitialisation).toHaveBeenCalled();
  });

  test("should resolve without flow", async () => {
    ctx.data.flowType = undefined;

    await expect(createLoginSessionController(ctx)).resolves.toStrictEqual({
      body: { id: "id" },
    });

    expect(handleFlowInitialisation).not.toHaveBeenCalled();
  });
});
