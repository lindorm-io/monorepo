import { AuthenticationMethods } from "@lindorm-io/common-types";
import { RefreshSession, RefreshSessionOptions } from "../../entity";
import { randomUUID } from "crypto";
import { randomString } from "@lindorm-io/random";

export const createTestRefreshSession = (
  options: Partial<RefreshSessionOptions> = {},
): RefreshSession =>
  new RefreshSession({
    audiences: [randomUUID()],
    browserSessionId: randomUUID(),
    clientId: randomUUID(),
    expires: new Date("2021-02-01T08:00:00.000Z"),
    identityId: randomUUID(),
    latestAuthentication: new Date("2021-01-01T07:59:00.000Z"),
    levelOfAssurance: 2,
    methods: [AuthenticationMethods.EMAIL, AuthenticationMethods.PHONE],
    nonce: randomString(16),
    refreshTokenId: randomUUID(),
    scopes: ["openid", "profile"],
    ...options,
  });
