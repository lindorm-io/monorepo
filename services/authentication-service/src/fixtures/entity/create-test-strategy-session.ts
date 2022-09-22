import { AuthenticationStrategy } from "../../enum";
import { SessionStatus } from "../../common";
import { StrategySession, StrategySessionOptions } from "../../entity";
import { baseHash, randomNumber, randomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";

export const createTestStrategySession = (
  options: Partial<StrategySessionOptions> = {},
): StrategySession =>
  new StrategySession({
    authenticationSessionId: randomUUID(),
    code: baseHash(randomString(64)),
    email: "test@lindorm.io",
    expires: new Date("2022-01-01T08:00:00.000Z"),
    nin: "19010101-9999",
    nonce: randomString(16),
    otp: baseHash(randomNumber(6).toString()),
    phoneNumber: `07${randomNumber(8)}`,
    status: SessionStatus.PENDING,
    strategy: AuthenticationStrategy.EMAIL_OTP,
    username: "username",
    ...options,
  });
