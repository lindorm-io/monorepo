import { ConsentSession, ConsentSessionOptions } from "../../entity";
import { ClientType, Scope } from "../../common";
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
    requestedScopes: [Scope.EMAIL, Scope.OPENID, Scope.PHONE, Scope.PROFILE],
    requiredScopes: [Scope.OPENID, Scope.PROFILE],
    scopeDescriptions: [
      { name: "email", description: "email-description" },
      { name: "openid", description: "openid-description" },
      { name: "phone", description: "phone-description" },
      { name: "profile", description: "profile-description" },
    ],
    type: ClientType.PUBLIC,
    ...options,
  });
