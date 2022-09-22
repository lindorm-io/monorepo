import { RefreshSession, RefreshSessionOptions } from "../../entity";
import { randomUUID } from "crypto";
import { randomString } from "@lindorm-io/core";
import { AuthenticationMethod } from "../../common";

export const createTestRefreshSession = (
  options: Partial<RefreshSessionOptions> = {},
): RefreshSession =>
  new RefreshSession({
    acrValues: ["loa_2"],
    amrValues: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
    clientId: randomUUID(),
    expires: new Date("2021-02-01T08:00:00.000Z"),
    identityId: randomUUID(),
    levelOfAssurance: 2,
    nonce: randomString(16),
    tokenId: randomUUID(),
    uiLocales: ["sv-SE", "en-GB"],
    ...options,
  });
