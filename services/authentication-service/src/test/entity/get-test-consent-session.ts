import { ConsentSession, ConsentSessionOptions } from "../../entity";
import { ClientType } from "../../common";

export const getTestConsentSession = (
  options: Partial<ConsentSessionOptions> = {},
): ConsentSession =>
  new ConsentSession({
    description: "description",
    expires: new Date("2022-01-01T08:00:00.000Z"),
    logoUri: "https://client.logo.uri/",
    name: "name",
    oauthSessionId: "d8feb309-b3c6-4070-b41b-7253048a2d89",
    requestedAudiences: ["31dfe6b3-0015-4546-ac76-0bf4f3c638b7"],
    requestedScopes: ["openid", "email"],
    requiredScopes: ["openid", "email"],
    scopeDescriptions: [{ name: "email", description: "email-description" }],
    type: ClientType.PUBLIC,
    ...options,
  });
