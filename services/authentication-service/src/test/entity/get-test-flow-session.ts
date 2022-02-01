import { FlowSession, FlowSessionOptions } from "../../entity";
import { SessionStatus } from "../../common";
import { baseHash } from "@lindorm-io/core";
import { FlowType } from "../../enum";

export const getTestFlowSession = (options: Partial<FlowSessionOptions> = {}): FlowSession =>
  new FlowSession({
    code: "7598650d",
    email: "test@lindorm.io",
    expires: new Date("2022-01-01T08:00:00.000Z"),
    loginSessionId: "b1c842ec-e7b2-4f88-a2b4-1385922bd232",
    nin: "19010101-9999",
    nonce: "4369b02b0b4f4d2d",
    otp: baseHash("123456"),
    phoneNumber: "0703557799",
    status: SessionStatus.PENDING,
    type: FlowType.EMAIL_OTP,
    username: "username",
    ...options,
  });
