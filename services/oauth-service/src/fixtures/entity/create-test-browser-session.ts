import { BrowserSession, BrowserSessionOptions } from "../../entity";
import { randomUUID } from "crypto";
import { AuthenticationMethods } from "@lindorm-io/common-types";

export const createTestBrowserSession = (
  options: Partial<BrowserSessionOptions> = {},
): BrowserSession =>
  new BrowserSession({
    identityId: randomUUID(),
    latestAuthentication: new Date("2021-01-01T07:59:00.000Z"),
    levelOfAssurance: 2,
    methods: [AuthenticationMethods.EMAIL, AuthenticationMethods.PHONE],
    remember: true,
    sso: true,
    ...options,
  });
