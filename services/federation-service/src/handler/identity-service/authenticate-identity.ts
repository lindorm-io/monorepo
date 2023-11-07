import { AddIdentifierRequestBody, IdentifierType } from "@lindorm-io/common-types";
import { ServerError } from "@lindorm-io/errors";
import { FederationSession } from "../../entity";
import { clientCredentialsMiddleware } from "../../middleware";
import { ServerKoaContext } from "../../types";

type Options = {
  provider: string;
  subject: string;
};

type Result = { identityId: string };

export const authenticateIdentity = async (
  ctx: ServerKoaContext,
  federationSession: FederationSession,
  options: Options,
): Promise<Result> => {
  const {
    axios: { identityClient },
  } = ctx;

  const { identityId } = federationSession;
  const { provider, subject } = options;

  if (!identityId) {
    throw new ServerError("Invalid federation session", {
      description: "Attribute is required",
      debug: { identityId },
    });
  }

  await identityClient.post<never, AddIdentifierRequestBody>("/admin/identifiers", {
    body: {
      identifier: subject,
      identityId,
      label: null,
      provider,
      type: IdentifierType.EXTERNAL,
      verified: true,
    },
    middleware: [clientCredentialsMiddleware()],
  });

  return { identityId };
};
