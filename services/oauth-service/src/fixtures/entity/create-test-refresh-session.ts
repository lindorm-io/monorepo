import { AuthenticationMethods } from "@lindorm-io/common-types";
import { RefreshSession, RefreshSessionOptions } from "../../entity";
import { randomString } from "@lindorm-io/random";
import { randomUUID } from "crypto";

export const createTestRefreshSession = (
  options: Partial<RefreshSessionOptions> = {},
): RefreshSession =>
  new RefreshSession({
    acrValues: ["loa_2"],
    amrValues: [AuthenticationMethods.EMAIL, AuthenticationMethods.PHONE],
    clientId: randomUUID(),
    expires: new Date("2021-02-01T08:00:00.000Z"),
    identityId: randomUUID(),
    levelOfAssurance: 2,
    nonce: randomString(16),
    tokenId: randomUUID(),
    uiLocales: ["sv-SE", "en-GB"],
    ...options,
  });
