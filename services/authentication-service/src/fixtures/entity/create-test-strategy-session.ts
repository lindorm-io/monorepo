import { AuthenticationStrategy, IdentifierType, SessionStatus } from "@lindorm-io/common-enums";
import { baseHash } from "@lindorm-io/core";
import { randomNumber } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { StrategySession, StrategySessionOptions } from "../../entity";

export const createTestStrategySession = (
  options: Partial<StrategySessionOptions> = {},
): StrategySession =>
  new StrategySession({
    authenticationSessionId: randomUUID(),
    expires: new Date("2022-01-01T08:00:00.000Z"),
    identifier: "test@lindorm.io",
    identifierType: IdentifierType.EMAIL,
    secret: baseHash(randomNumber(6).toString()),
    status: SessionStatus.PENDING,
    strategy: AuthenticationStrategy.EMAIL_OTP,
    ...options,
  });
