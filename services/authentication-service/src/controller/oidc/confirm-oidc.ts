import Joi from "joi";
import { ClientError } from "@lindorm-io/errors";
import { ClientScope, GetOidcSessionResponseBody, JOI_GUID, SessionStatus } from "../../common";
import { ControllerResponse } from "@lindorm-io/koa";
import { ServerKoaController } from "../../types";
import { calculateAuthenticationStatus } from "../../util";
import { clientCredentialsMiddleware } from "../../middleware";
import { configuration } from "../../server/configuration";
import { createURL } from "@lindorm-io/core";
import { resolveAllowedStrategies } from "../../handler";

type RequestData = {
  sessionId: string;
};

export const confirmOidcSchema = Joi.object<RequestData>()
  .keys({
    sessionId: JOI_GUID.required(),
  })
  .required();

export const confirmOidcController: ServerKoaController<RequestData> = async (
  ctx,
): ControllerResponse => {
  const {
    axios: { oauthClient, oidcClient },
    cache: { authenticationSessionCache },
    data: { sessionId },
    repository: { accountRepository },
  } = ctx;

  const {
    data: { callbackId, identityId, levelOfAssurance, provider },
  } = await oidcClient.get<GetOidcSessionResponseBody>("/internal/sessions/:id", {
    params: { id: sessionId },
    middleware: [clientCredentialsMiddleware(oauthClient, [ClientScope.OIDC_SESSION_READ])],
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
      query: { sessionId: authenticationSession.id },
    }),
  };
};
