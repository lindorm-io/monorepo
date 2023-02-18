import { AccessSession, AccessSessionOptions } from "../../entity";
import { randomUUID } from "crypto";
import { AuthenticationMethods } from "@lindorm-io/common-types";
import { randomString } from "@lindorm-io/random";

export const createTestAccessSession = (
  options: Partial<AccessSessionOptions> = {},
): AccessSession =>
  new AccessSession({
    audiences: [randomUUID()],
    browserSessionId: randomUUID(),
    clientId: randomUUID(),
    identityId: randomUUID(),
    latestAuthentication: new Date("2021-01-01T07:59:00.000Z"),
    levelOfAssurance: 2,
    methods: [AuthenticationMethods.EMAIL, AuthenticationMethods.PHONE],
    nonce: randomString(16),
    scopes: ["openid", "profile"],
    ...options,
  });
