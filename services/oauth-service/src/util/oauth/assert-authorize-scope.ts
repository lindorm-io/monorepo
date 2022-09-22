import { AuthorizationSession, Client } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { difference } from "lodash";

export const assertAuthorizeScope = (
  authorizationSession: AuthorizationSession,
  client: Client,
): void => {
  const diff = difference(authorizationSession.requestedConsent.scopes, client.allowed.scopes);

  if (diff.length) {
    throw new ClientError("Invalid Scope", {
      code: "invalid_request",
      description: "invalid_scope",
      debug: {
        expect: client.allowed.scopes,
        actual: authorizationSession.requestedConsent.scopes,
        diff,
      },
    });
  }
};
