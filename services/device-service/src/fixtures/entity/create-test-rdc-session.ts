import {
  HttpMethod,
  RdcSessionMode,
  RdcSessionType,
  SessionStatus,
} from "@lindorm-io/common-enums";
import { randomHex } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import { RdcSession, RdcSessionOptions } from "../../entity";

export const createTestRdcSession = (options: Partial<RdcSessionOptions> = {}): RdcSession =>
  new RdcSession({
    audiences: ["7bb4396b-5bad-4e6e-8edb-4f0f3c20e902"],
    confirmMethod: HttpMethod.PUT,
    confirmPayload: { confirm: true },
    confirmUri: "https://callback.lindorm.io/confirm",
    deviceLinks: [randomUUID()],
    enrolmentSessionId: null,
    expires: new Date("2021-01-10T08:00:00.000Z"),
    factors: 1,
    identityId: randomUUID(),
    mode: RdcSessionMode.PUSH_NOTIFICATION,
    nonce: randomHex(16),
    rejectMethod: HttpMethod.DELETE,
    rejectPayload: { reject: true },
    rejectUri: "https://callback.lindorm.io/reject",
    scopes: [],
    status: SessionStatus.PENDING,
    templateName: "template",
    templateParameters: { template: true },
    tokenPayload: { token: true },
    type: RdcSessionType.CALLBACK,
    ...options,
  });
