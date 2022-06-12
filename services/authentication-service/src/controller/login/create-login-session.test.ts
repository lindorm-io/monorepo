import { ClientError } from "@lindorm-io/errors";
import { createLoginSessionController } from "./create-login-session";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestAccount, createTestLoginSession } from "../../fixtures/entity";
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
        loginSessionCache: createMockCache(createTestLoginSession),
      },
      data: {
        country: "country",
        email: "email",
        flowType: "email_link",
        identityId: "identityId",
        nonce: "nonce",
        phoneNumber: "phoneNumber",
        pkceChallenge: "pkceChallenge",
        pkceMethod: "pkceMethod",
        username: "username",
      },
      repository: {
        accountRepository: createMockRepository(createTestAccount),
      },
    };

    handleFlowInitialisation.mockResolvedValue("mocked-flow");
    resolveAllowedFlows.mockImplementation(async (ctx, loginSession, account) => {
      loginSession.allowedFlows = ["email_link"];
      return loginSession;
    });
  });

  afterEach(jest.resetAllMocks);

  test("should resolve", async () => {
    await expect(createLoginSessionController(ctx)).resolves.toStrictEqual({
      body: { id: expect.any(String), flow: "mocked-flow" },
    });

    expect(handleFlowInitialisation).toHaveBeenCalled();
  });

  test("should resolve without flow", async () => {
    ctx.data.flowType = undefined;

    await expect(createLoginSessionController(ctx)).resolves.toStrictEqual({
      body: { id: expect.any(String) },
    });

    expect(handleFlowInitialisation).not.toHaveBeenCalled();
  });

  test("should reject invalid flow", async () => {
    ctx.data.flowType = "wrong";

    await expect(createLoginSessionController(ctx)).rejects.toThrow(ClientError);
  });
});
