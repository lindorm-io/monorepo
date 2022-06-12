import { ClientError } from "@lindorm-io/errors";
import { createMockCache } from "@lindorm-io/redis";
import { createTestLoginSession } from "../../fixtures/entity";
import { handleFlowInitialisation as _handleFlowInitialisation } from "../../handler";
import { initialiseFlowController } from "./initialise-flow";

jest.mock("../../handler");

const handleFlowInitialisation = _handleFlowInitialisation as jest.Mock;

describe("initialiseFlowController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        loginSessionCache: createMockCache(createTestLoginSession),
      },
      data: {
        email: "email",
        flowType: "email_link",
        nonce: "nonce",
        phoneNumber: "phoneNumber",
        remember: "remember",
        username: "username",
      },
      entity: {
        loginSession: createTestLoginSession(),
      },
    };

    handleFlowInitialisation.mockResolvedValue("flow");
  });

  test("should resolve", async () => {
    await expect(initialiseFlowController(ctx)).resolves.toStrictEqual({ body: "flow" });

    expect(ctx.cache.loginSessionCache.update).toHaveBeenCalled();
  });

  test("should reject invalid flow type", async () => {
    ctx.data.flowType = "wrong";

    await expect(initialiseFlowController(ctx)).rejects.toThrow(ClientError);
  });
});
