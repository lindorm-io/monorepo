import { createStrategySessionToken as _createStrategySessionToken } from "../../handler";
import { createMockCache } from "@lindorm-io/redis";
import { createTestStrategySession } from "../../fixtures/entity";
import { acknowledgeStrategyController } from "./acknowledge-strategy";
import { AuthenticationStrategy, SessionStatus } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";

jest.mock("../../handler");

const createStrategySessionToken = _createStrategySessionToken as jest.Mock;

describe("confirmStrategyController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        strategySessionCache: createMockCache(createTestStrategySession),
      },
      entity: {
        strategySession: createTestStrategySession({
          strategy: AuthenticationStrategy.SESSION_QR_CODE,
        }),
      },
      token: {
        bearerToken: { subject: "" },
      },
    };

    createStrategySessionToken.mockImplementation(() => "createStrategySessionToken");
  });

  test("should resolve", async () => {
    await expect(acknowledgeStrategyController(ctx)).resolves.toStrictEqual({
      body: {
        code: expect.any(String),
        strategySessionToken: "createStrategySessionToken",
      },
    });
  });

  test("should throw on invalid status", async () => {
    ctx.entity.strategySession = createTestStrategySession({
      status: SessionStatus.ACKNOWLEDGED,
    });

    await expect(acknowledgeStrategyController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid strategy", async () => {
    ctx.entity.strategySession = createTestStrategySession({
      strategy: AuthenticationStrategy.EMAIL_CODE,
    });

    await expect(acknowledgeStrategyController(ctx)).rejects.toThrow(ClientError);
  });
});
