import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ClientScopes } from "../../common";
import { ControllerResponse } from "@lindorm-io/koa";
import { GetOidcSessionResponse, SessionStatus } from "@lindorm-io/common-types";
import { ServerKoaController } from "../../types";
import { calculateAuthenticationStatus } from "../../util";
import { clientCredentialsMiddleware } from "../../middleware";
import { configuration } from "../../server/configuration";
import { createURL } from "@lindorm-io/url";
import { resolveAllowedStrategies } from "../../handler";

type RequestData = {
  session: string;
};

export const confirmOidcSchema = Joi.object<RequestData>()
  .keys({
    session: Joi.string().guid().required(),
  })
  .required();

export const confirmOidcController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { oauthClient, oidcClient },
    cache: { authenticationSessionCache },
    data: { session },
    repository: { accountRepository },
  } = ctx;

  const {
    data: { callbackId, identityId, levelOfAssurance, provider },
  } = await oidcClient.get<GetOidcSessionResponse>("/admin/sessions/:id", {
    params: { id: session },
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScopes.OIDC_SESSION_READ])],
  });

  const authenticationSession = await authenticationSessionCache.find({ id: callbackId });

  if (authenticationSession.identityId && authenticationSession.identityId !== identityId) {
    throw new ClientError("Invalid identity", {
      description: "Identity ID mismatch",
      debug: {
        expect: authenticationSession.identityId,
        actual: identityId,
      },
    });
  }

  const account = await accountRepository.findOrCreate({ id: identityId });

  authenticationSession.identityId = account.id;
  authenticationSession.confirmedOidcLevel = levelOfAssurance;
  authenticationSession.confirmedOidcProvider = provider;

  authenticationSession.status = calculateAuthenticationStatus(authenticationSession);

  if (authenticationSession.status === SessionStatus.PENDING) {
    authenticationSession.allowedStrategies = await resolveAllowedStrategies(
      ctx,
      authenticationSession,
      account,
    );
  }

  await authenticationSessionCache.update(authenticationSession);

  return {
    redirect: createURL(configuration.frontend.routes.oidc, {
      host: configuration.frontend.host,
      port: configuration.frontend.port,
      query: { session: authenticationSession.id },
    }),
  };
};
