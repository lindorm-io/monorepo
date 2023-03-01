import { AddIdentifierRequestBody } from "@lindorm-io/common-types";
import { AuthenticationSession, StrategySession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";

type Result = { identityId: string };

export const authenticateIdentifier = async (
  ctx: ServerKoaContext,
  authenticationSession: AuthenticationSession,
  strategySession: StrategySession,
): Promise<Result> => {
  const {
    axios: { identityClient, oauthClient },
  } = ctx;

  const { identityId } = authenticationSession;
  const { identifier, identifierType } = strategySession;

  if (!identityId) {
    throw new ServerError("Invalid authentication session", {
      description: "Attribute is required",
      debug: { identityId },
    });
  }

  if (!identifier || !identifierType) {
    throw new ServerError("Invalid strategy session", {
      description: "Attributes are required",
      debug: { identifier, identifierType },
    });
  }

  await identityClient.post<never, AddIdentifierRequestBody>("/admin/identifiers", {
    body: {
      identifier,
      identityId,
      label: null,
      type: identifierType,
      verified: true,
    },
    middleware: [clientCredentialsMiddleware(oauthClient)],
  });

  return { identityId };
};
