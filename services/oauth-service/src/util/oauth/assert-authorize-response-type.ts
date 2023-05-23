import { OpenIdResponseType } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { difference } from "lodash";
import { AuthorizationRequest, Client } from "../../entity";

export const assertAuthorizeResponseType = (
  authorizationRequest: AuthorizationRequest,
  client: Client,
): void => {
  const diff = difference(authorizationRequest.responseTypes, client.allowed.responseTypes);

  if (diff.length) {
    throw new ClientError("Invalid Response Type", {
      code: "invalid_request",
      description: "Invalid response type",
      debug: {
        expect: client.allowed.responseTypes,
        actual: authorizationRequest.responseTypes,
        diff,
      },
    });
  }

  if (
    authorizationRequest.responseTypes.includes(OpenIdResponseType.CODE) &&
    (!authorizationRequest.code.codeChallenge || !authorizationRequest.code.codeChallengeMethod)
  ) {
    throw new ClientError("Invalid request combination", {
      code: "invalid_request",
      description: "code_challenge and code_challenge_method required for response type: code",
      debug: {
        responseTypes: authorizationRequest.responseTypes,
        codeChallenge: authorizationRequest.code.codeChallenge,
        codeChallengeMethod: authorizationRequest.code.codeChallengeMethod,
      },
    });
  }
};
