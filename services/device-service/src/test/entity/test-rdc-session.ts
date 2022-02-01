import { RdcSession, RdcSessionOptions } from "../../entity";
import { RdcSessionType } from "../../enum";
import { SessionStatus, RdcSessionMode, RequestMethod } from "../../common";
import { getRandomString } from "@lindorm-io/core";
import { randomUUID } from "crypto";

export const getTestRdcSession = (options: Partial<RdcSessionOptions> = {}): RdcSession =>
  new RdcSession({
    clientId: "b639e4ac-81cb-4c4d-8c77-4ff6a4e3e7df",
    confirmMethod: RequestMethod.PUT,
    confirmPayload: { confirm: true },
    confirmUri: "https://callback.lindorm.io/confirm",
    deviceLinks: [randomUUID()],
    enrolmentSessionId: null,
    expires: new Date("2021-01-10T08:00:00.000Z"),
    factors: 1,
    identityId: randomUUID(),
    mode: RdcSessionMode.PUSH_NOTIFICATION,
    nonce: getRandomString(16),
    rejectMethod: RequestMethod.DELETE,
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
