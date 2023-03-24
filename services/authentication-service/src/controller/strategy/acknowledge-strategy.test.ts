import { createTestAuthenticationSession, createTestStrategySession } from "../../fixtures/entity";
import { acknowledgeStrategyController } from "./acknowledge-strategy";
import { AuthenticationStrategy, SessionStatus } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { getStrategyHandler as _getStrategyHandler } from "../../strategies";

jest.mock("../../strategies");

const getStrategyHandler = _getStrategyHandler as jest.Mock;

describe("confirmStrategyController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        acknowledgeCode: "X812OER1",
      },
      entity: {
        authenticationSession: createTestAuthenticationSession(),
        strategySession: createTestStrategySession({
          strategy: AuthenticationStrategy.SESSION_QR_CODE,
        }),
      },
      token: {
        bearerToken: { subject: "70701081-9e0b-4c76-a675-058c03f9e002" },
      },
    };

    getStrategyHandler.mockImplementation(() => ({
      acknowledge: async () => ({ code: "code", strategySessionToken: "jwt.jwt.jwt" }),
    }));
  });

  test("should resolve", async () => {
    await expect(acknowledgeStrategyController(ctx)).resolves.toStrictEqual({
      body: {
        code: "code",
        strategySessionToken: "jwt.jwt.jwt",
      },
    });

    expect(getStrategyHandler).toHaveBeenCalled();
  });

  test("should throw on invalid status", async () => {
    ctx.entity.strategySession = createTestStrategySession({
      status: SessionStatus.ACKNOWLEDGED,
    });

    await expect(acknowledgeStrategyController(ctx)).rejects.toThrow(ClientError);
  });
});
