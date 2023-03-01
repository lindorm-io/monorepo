import { AddIdentifierRequestBody, IdentifierType } from "@lindorm-io/common-types";
import { OidcSession } from "../../entity";
import { ServerError } from "@lindorm-io/errors";
import { ServerKoaContext } from "../../types";
import { clientCredentialsMiddleware } from "../../middleware";

type Options = {
  provider: string;
  subject: string;
};

type Result = { identityId: string };

export const authenticateIdentity = async (
  ctx: ServerKoaContext,
  oidcSession: OidcSession,
  options: Options,
): Promise<Result> => {
  const {
    axios: { identityClient },
  } = ctx;

  const { identityId } = oidcSession;
  const { provider, subject } = options;

  if (!identityId) {
    throw new ServerError("Invalid oidc session", {
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
