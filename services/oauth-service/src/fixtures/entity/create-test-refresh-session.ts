import { RefreshSession, RefreshSessionOptions } from "../../entity";
import { randomUUID } from "crypto";
import { getRandomString } from "@lindorm-io/core";

export const createTestRefreshSession = (
  options: Partial<RefreshSessionOptions> = {},
): RefreshSession =>
  new RefreshSession({
    acrValues: ["loa_2"],
    amrValues: ["email_otp", "phone_otp"],
    clientId: randomUUID(),
    expires: new Date("2021-02-01T08:00:00.000Z"),
    identityId: randomUUID(),
    levelOfAssurance: 2,
    nonce: getRandomString(16),
    tokenId: randomUUID(),
    uiLocales: ["sv-SE", "en-GB"],
    ...options,
  });
