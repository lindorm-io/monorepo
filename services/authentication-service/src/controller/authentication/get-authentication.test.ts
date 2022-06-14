import { AuthenticationMethod } from "../../enum";
import { SessionStatus } from "../../common";
import { calculatePrioritizedMethod as _calculatePrioritizedMethod } from "../../util";
import { createMockCache } from "@lindorm-io/redis";
import { createTestAuthenticationSession } from "../../fixtures/entity";
import { getAuthenticationController } from "./get-authentication";

jest.mock("../../util");

const calculatePrioritizedMethod = _calculatePrioritizedMethod as jest.Mock;

describe("getAuthenticationController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authenticationSessionCache: createMockCache(createTestAuthenticationSession),
      },
      entity: {
        authenticationSession: createTestAuthenticationSession(),
      },
    };

    calculatePrioritizedMethod.mockImplementation(() => AuthenticationMethod.DEVICE_CHALLENGE);
  });

  test("should resolve", async () => {
    await expect(getAuthenticationController(ctx)).resolves.toStrictEqual({
      body: {
        allowedMethods: ["bank_id_se", "device_challenge", "email_link", "email_otp", "phone_otp"],
        emailHint: "test@lindorm.io",
        expires: new Date("2022-01-01T08:00:00.000Z"),
        phoneHint: "0701234567",
        prioritizedMethod: "device_challenge",
        requestedMethods: ["email_otp"],
        status: "pending",
      },
    });
  });

  test("should resolve with code", async () => {
    ctx.entity.authenticationSession.status = SessionStatus.CONFIRMED;

    await expect(getAuthenticationController(ctx)).resolves.toStrictEqual({
      body: { code: expect.any(String) },
    });

    expect(ctx.cache.authenticationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        code: expect.any(String),
        status: SessionStatus.CODE,
      }),
    );
  });
});
