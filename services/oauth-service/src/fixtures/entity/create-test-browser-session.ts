import { BrowserSession, BrowserSessionOptions } from "../../entity";
import { randomUUID } from "crypto";
import { randomString } from "@lindorm-io/core";

export const createTestBrowserSession = (
  options: Partial<BrowserSessionOptions> = {},
): BrowserSession =>
  new BrowserSession({
    acrValues: ["loa_2"],
    amrValues: ["email_otp", "phone_otp"],
    clients: [randomUUID(), randomUUID(), randomUUID()],
    country: "se",
    expires: new Date("2021-04-01T08:00:00.000Z"),
    identityId: randomUUID(),
    latestAuthentication: new Date("2021-01-01T07:59:00.000Z"),
    levelOfAssurance: 2,
    nonce: randomString(16),
    remember: true,
    uiLocales: ["sv-SE", "en-GB"],
    ...options,
  });
