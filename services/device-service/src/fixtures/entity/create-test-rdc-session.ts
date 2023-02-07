import { RdcSession, RdcSessionOptions } from "../../entity";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";
import {
  RdcSessionMethods,
  RdcSessionModes,
  RdcSessionTypes,
  SessionStatuses,
} from "@lindorm-io/common-types";

export const createTestRdcSession = (options: Partial<RdcSessionOptions> = {}): RdcSession =>
  new RdcSession({
    audiences: ["7bb4396b-5bad-4e6e-8edb-4f0f3c20e902"],
    confirmMethod: RdcSessionMethods.PUT,
    confirmPayload: { confirm: true },
    confirmUri: "https://callback.lindorm.io/confirm",
    deviceLinks: [randomUUID()],
    enrolmentSessionId: null,
    expires: new Date("2021-01-10T08:00:00.000Z"),
    factors: 1,
    identityId: randomUUID(),
    mode: RdcSessionModes.PUSH_NOTIFICATION,
    nonce: randomString(16),
    rejectMethod: RdcSessionMethods.DELETE,
    rejectPayload: { reject: true },
    rejectUri: "https://callback.lindorm.io/reject",
    scopes: [],
    status: SessionStatuses.PENDING,
    templateName: "template",
    templateParameters: { template: true },
    tokenPayload: { token: true },
    type: RdcSessionTypes.CALLBACK,
    ...options,
  });
