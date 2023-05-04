import { AuthenticationMethod } from "@lindorm-io/common-types";
import { randomUUID } from "crypto";
import { BrowserSession, BrowserSessionOptions } from "../../entity";

export const createTestBrowserSession = (
  options: Partial<BrowserSessionOptions> = {},
): BrowserSession =>
  new BrowserSession({
    identityId: randomUUID(),
    latestAuthentication: new Date("2021-01-01T07:59:00.000Z"),
    levelOfAssurance: 2,
    metadata: { ip: "192.168.0.1", platform: "iOS" },
    methods: [AuthenticationMethod.EMAIL, AuthenticationMethod.PHONE],
    remember: true,
    singleSignOn: true,
    ...options,
  });
