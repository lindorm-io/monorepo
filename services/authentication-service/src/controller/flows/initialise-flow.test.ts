import { handleFlowInitialisation as _handleFlowInitialisation } from "../../handler";
import { initialiseFlowController } from "./initialise-flow";
import { getTestLoginSession } from "../../test/entity";

jest.mock("../../handler");

const handleFlowInitialisation = _handleFlowInitialisation as jest.Mock;

describe("initialiseFlowController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        loginSessionCache: {
          update: jest.fn().mockImplementation(async (arg) => arg),
        },
      },
      data: {
        email: "email",
        flowType: "flowType",
        nonce: "nonce",
        phoneNumber: "phoneNumber",
        remember: "remember",
        username: "username",
      },
      entity: {
        loginSession: getTestLoginSession(),
      },
    };

    handleFlowInitialisation.mockResolvedValue("flow");
  });

  test("should resolve", async () => {
    await expect(initialiseFlowController(ctx)).resolves.toStrictEqual({ body: "flow" });

    expect(ctx.cache.loginSessionCache.update).toHaveBeenCalled();
  });
});
