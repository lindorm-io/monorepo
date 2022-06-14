import { AuthenticationMethod } from "../../enum";
import { SessionStatus } from "../../common";
import { StrategySession, StrategySessionOptions } from "../../entity";
import { baseHash, getRandomNumber, getRandomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";

export const createTestStrategySession = (
  options: Partial<StrategySessionOptions> = {},
): StrategySession =>
  new StrategySession({
    authenticationSessionId: randomUUID(),
    code: baseHash(getRandomString(64)),
    email: "test@lindorm.io",
    expires: new Date("2022-01-01T08:00:00.000Z"),
    nin: "19010101-9999",
    nonce: getRandomString(16),
    otp: baseHash(getRandomNumber(6).toString()),
    phoneNumber: `07${getRandomNumber(8)}`,
    status: SessionStatus.PENDING,
    method: AuthenticationMethod.EMAIL_OTP,
    username: "username",
    ...options,
  });
