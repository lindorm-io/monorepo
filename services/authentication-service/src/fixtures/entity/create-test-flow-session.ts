import { FlowSession, FlowSessionOptions } from "../../entity";
import { SessionStatus } from "../../common";
import { baseHash, getRandomNumber, getRandomString } from "@lindorm-io/core";
import { FlowType } from "../../enum";
import { randomUUID } from "crypto";

export const createTestFlowSession = (options: Partial<FlowSessionOptions> = {}): FlowSession =>
  new FlowSession({
    code: baseHash(getRandomString(64)),
    email: "test@lindorm.io",
    expires: new Date("2022-01-01T08:00:00.000Z"),
    loginSessionId: randomUUID(),
    nin: "19010101-9999",
    nonce: getRandomString(16),
    otp: baseHash(getRandomNumber(6).toString()),
    phoneNumber: `07${getRandomNumber(8)}`,
    status: SessionStatus.PENDING,
    type: FlowType.EMAIL_OTP,
    username: "username",
    ...options,
  });
