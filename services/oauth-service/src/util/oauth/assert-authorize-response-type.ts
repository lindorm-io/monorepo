import { AuthorizationSession, Client } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { difference } from "lodash";
import { OauthResponseTypes } from "@lindorm-io/common-types";

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
    authorizationSession.responseTypes.includes(OauthResponseTypes.CODE) &&
    (!authorizationSession.code.codeChallenge || !authorizationSession.code.codeChallengeMethod)
  ) {
    throw new ClientError("Invalid request combination", {
      code: "invalid_request",
      description: "code_challenge and code_challenge_method required for response type: code",
      debug: {
        responseTypes: authorizationSession.responseTypes,
        codeChallenge: authorizationSession.code.codeChallenge,
        codeChallengeMethod: authorizationSession.code.codeChallengeMethod,
      },
    });
  }
};
