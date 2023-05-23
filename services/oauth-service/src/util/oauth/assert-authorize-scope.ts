import { ClientError } from "@lindorm-io/errors";
import { difference } from "lodash";
import { AuthorizationRequest, Client } from "../../entity";

export const assertAuthorizeScope = (
  authorizationRequest: AuthorizationRequest,
  client: Client,
): void => {
  const diff = difference(authorizationRequest.requestedConsent.scopes, client.allowed.scopes);

  if (diff.length) {
    throw new ClientError("Invalid Scope", {
      code: "invalid_request",
      description: "invalid_scope",
      debug: {
        expect: client.allowed.scopes,
        actual: authorizationRequest.requestedConsent.scopes,
        diff,
      },
    });
  }
};
