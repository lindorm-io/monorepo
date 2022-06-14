import { ConsentSession, ConsentSessionOptions } from "../../entity";
import { ClientType } from "../../common";
import { randomUUID } from "crypto";

export const createTestConsentSession = (
  options: Partial<ConsentSessionOptions> = {},
): ConsentSession =>
  new ConsentSession({
    description: "description",
    expires: new Date("2022-01-01T08:00:00.000Z"),
    logoUri: "https://client.logo.uri/",
    name: "name",
    oauthSessionId: randomUUID(),
    requestedAudiences: [randomUUID()],
    requestedScopes: ["openid", "email"],
    requiredScopes: ["openid", "email"],
    scopeDescriptions: [{ name: "email", description: "email-description" }],
    type: ClientType.PUBLIC,
    ...options,
  });
