import { StrategySession, StrategySessionOptions } from "../../entity";
import { baseHash } from "@lindorm-io/core";
import { randomNumber, randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { AuthenticationStrategies, SessionStatuses } from "@lindorm-io/common-types";

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
    status: SessionStatuses.PENDING,
    strategy: AuthenticationStrategies.EMAIL_OTP,
    username: "username",
    ...options,
  });
