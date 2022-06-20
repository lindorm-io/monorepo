import { AuthorizationSession, Client } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { ResponseType } from "../../common";
import { difference } from "lodash";

export const assertAuthorizeResponseType = (
  authorizationSession: AuthorizationSession,
  client: Client,
): void => {
  const diff = difference(authorizationSession.responseTypes, client.allowed.responseTypes);

  if (diff.length) {
    throw new ClientError("Invalid Response Type", {
      code: "invalid_request",
      description: "Invalid response type",
      debug: {
        expect: client.allowed.responseTypes,
        actual: authorizationSession.responseTypes,
        diff,
      },
    });
  }

  if (
    authorizationSession.responseTypes.includes(ResponseType.CODE) &&
    (!authorizationSession.codeChallenge || !authorizationSession.codeChallengeMethod)
  ) {
    throw new ClientError("Invalid request combination", {
      code: "invalid_request",
      description: "code_challenge and code_challenge_method required for response type: code",
      debug: {
        responseTypes: authorizationSession.responseTypes,
        codeChallenge: authorizationSession.codeChallenge,
        codeChallengeMethod: authorizationSession.codeChallengeMethod,
      },
    });
  }
};
