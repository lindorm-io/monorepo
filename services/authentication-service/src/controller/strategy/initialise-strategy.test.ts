import MockDate from "mockdate";
import { AuthenticationStrategy } from "@lindorm-io/common-types";
import { createMockCache } from "@lindorm-io/redis";
import { createTestAuthenticationSession, createTestStrategySession } from "../../fixtures/entity";
import { getStrategyHandler as _getStrategyHandler } from "../../strategies";
import { initialiseStrategyController } from "./initialise-strategy";

MockDate.set("2022-01-01T07:00:00.000Z");

jest.mock("../../strategies");

const getStrategyHandler = _getStrategyHandler as jest.Mock;

describe("initialiseStrategyController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        strategySessionCache: createMockCache(createTestStrategySession),
      },
      data: {
        email: "email",
        nin: "nin",
        nonce: "nonce",
        phoneNumber: "phoneNumber",
        strategy: "device_challenge",
        username: "username",
      },
      entity: {
        authenticationSession: createTestAuthenticationSession({
          allowedStrategies: Object.values(AuthenticationStrategy),
        }),
      },
      jwt: {
        sign: jest.fn().mockImplementation(() => ({ token: "jwt.jwt.jwt" })),
      },
    };

    getStrategyHandler.mockImplementation(() => ({
      initialise: async () => "initialise_result",
    }));
  });

  test("should resolve", async () => {
    await expect(initialiseStrategyController(ctx)).resolves.toStrictEqual({
      body: "initialise_result",
    });

    expect(ctx.cache.strategySessionCache.create).toHaveBeenCalled();
  });
});
